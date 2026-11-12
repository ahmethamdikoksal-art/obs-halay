// YouTube Data API v3 ile canlı sohbeti YALNIZ OKUR (API anahtarı; OAuth, şifre, çerez yok).
// Ağ çağrıları `getir` (fetch) ile dışarıdan verilebilir; testler sahte yanıtla çalışır.

const API = 'https://www.googleapis.com/youtube/v3';
export const EN_AZ_ARALIK_MS = 5000; // kota için: YouTube daha kısa önerse bile 5 sn'den sık sorma

export class YoutubeHatasi extends Error {
  constructor(durum, neden, mesaj) { super(mesaj); this.durum = durum; this.neden = neden; }
}

// youtube.com/live/ID, watch?v=ID, youtu.be/ID, shorts/ID ya da çıplak 11 karakterlik kimlik
export function videoKimligi(girdi) {
  const s = String(girdi ?? '').trim();
  if (/^[\w-]{11}$/.test(s)) return s;
  try {
    const u = new URL(s);
    if (!/(^|\.)youtube\.com$|(^|\.)youtu\.be$/.test(u.hostname)) return null;
    if (u.hostname.endsWith('youtu.be')) return /^\/([\w-]{11})/.exec(u.pathname)?.[1] ?? null;
    const v = u.searchParams.get('v');
    if (v && /^[\w-]{11}$/.test(v)) return v;
    return /^\/(?:live|shorts|embed)\/([\w-]{11})/.exec(u.pathname)?.[1] ?? null;
  } catch { return null; }
}

async function iste(getir, anahtar, yol, prm) {
  const url = `${API}/${yol}?${new URLSearchParams(prm)}`;
  // anahtar adreste değil başlıkta: günlüğe ya da hata mesajına sızmaz
  const y = await getir(url, { headers: { 'x-goog-api-key': anahtar }, signal: AbortSignal.timeout(10000) });
  let veri = null;
  try { veri = await y.json(); } catch {}
  if (!y.ok) {
    const e = veri?.error ?? {};
    const neden = e.details?.find((d) => d.reason)?.reason || e.errors?.[0]?.reason || String(y.status);
    throw new YoutubeHatasi(y.status, neden, e.message || `HTTP ${y.status}`);
  }
  return veri;
}

export function anahtarHatasiMi(h) {
  return h instanceof YoutubeHatasi && /API_KEY|keyInvalid|forbidden|accessNotConfigured|SERVICE_DISABLED|ipRefererBlocked|API_KEY_SERVICE_BLOCKED/i.test(h.neden);
}
export function kotaHatasiMi(h) {
  return h instanceof YoutubeHatasi && /quotaExceeded|dailyLimitExceeded|rateLimitExceeded|RATE_LIMIT/i.test(h.neden);
}
export function sohbetBittiMi(h) {
  return h instanceof YoutubeHatasi && (/liveChatEnded|liveChatNotFound|liveChatDisabled/.test(h.neden) || h.durum === 404);
}

// videos.list (1 kota birimi): {sohbetId, begeni, baslik} — yayında değilse sohbetId null
export async function videoBilgisi(getir, anahtar, id) {
  const v = await iste(getir, anahtar, 'videos', { part: 'snippet,liveStreamingDetails,statistics', id });
  const it = v?.items?.[0];
  if (!it) throw new YoutubeHatasi(404, 'videoNotFound', 'Video bulunamadı ya da gizli');
  const lsd = it.liveStreamingDetails ?? {};
  const begeni = it.statistics?.likeCount;
  return {
    sohbetId: lsd.actualEndTime ? null : (lsd.activeLiveChatId ?? null),
    begeni: begeni === undefined ? null : Number(begeni),
    baslik: it.snippet?.title ?? '',
  };
}

function ad(item) { return String(item?.authorDetails?.displayName || 'izleyici').replace(/^@/, '').slice(0, 24); }

// Sohbet mesajını oyun olayına çevirir: {tur:'yorum'|'hediye', ...} ya da null
export function mesajOlayi(item) {
  const sn = item?.snippet ?? {};
  switch (sn.type) {
    case 'textMessageEvent':
      return { tur: 'yorum', ad: ad(item), metin: String(sn.textMessageDetails?.messageText ?? sn.displayMessage ?? '').slice(0, 200) };
    case 'superChatEvent':
      return { tur: 'hediye', ad: ad(item), adet: 1, metin: 'Super Chat ' + (sn.superChatDetails?.amountDisplayString ?? '') };
    case 'superStickerEvent':
      return { tur: 'hediye', ad: ad(item), adet: 1, metin: 'Super Sticker ' + (sn.superStickerDetails?.amountDisplayString ?? '') };
    case 'newSponsorEvent':
      return { tur: 'hediye', ad: ad(item), adet: 1, metin: 'üyelik' };
    case 'membershipGiftingEvent':
      return { tur: 'hediye', ad: ad(item), adet: Math.max(1, Number(sn.membershipGiftingDetails?.giftMembershipsCount) || 1), metin: 'hediye üyelik' };
    default:
      return null; // giftMembershipReceivedEvent, memberMilestoneChatEvent, silme vb. atılır
  }
}

// Toplam beğeni sayısından artışı çıkarır. İlk okuma tabandır; düşüş ya da gizli sayı olay üretmez.
export class BegeniSayaci {
  constructor() { this.son = null; }
  guncelle(toplam) {
    if (toplam === null || toplam === undefined || !Number.isFinite(Number(toplam))) return null;
    toplam = Number(toplam);
    const once = this.son;
    if (once === null || toplam < once) { this.son = toplam; return null; }
    this.son = toplam;
    const artis = toplam - once;
    return artis > 0 ? { tur: 'begeni', ad: 'YouTube', adet: artis } : null;
  }
}

const uyuVarsayilan = (ms, sinyal) => new Promise((ok) => {
  const t = setTimeout(ok, ms);
  sinyal?.addEventListener('abort', () => { clearTimeout(t); ok(); }, { once: true });
});

// liveChatMessages.list döngüsü. Dönüş: 'bitti' | 'anahtar' | 'durduruldu'
// Açılışta eski mesajlar işlenmez (yalnız nextPageToken alınır).
// sayfaOkundu(n): her başarılı okumada o sayfadaki mesaj sayısıyla çağrılır (teşhis sayaçları için)
export async function sohbetOku({ anahtar, sohbetId, olayVer, getir = fetch, uyu = uyuVarsayilan, sinyal, gunluk = () => {}, kotaBekleme = 15 * 60000, enAzAralik = EN_AZ_ARALIK_MS, sayfaOkundu = () => {} }) {
  let sayfa = null;
  let ilk = true;
  while (!sinyal?.aborted) {
    let v;
    try {
      v = await iste(getir, anahtar, 'liveChat/messages', {
        liveChatId: sohbetId, part: 'snippet,authorDetails', maxResults: '2000', ...(sayfa ? { pageToken: sayfa } : {}),
      });
    } catch (h) {
      if (sohbetBittiMi(h)) { gunluk(`sohbet kapandı (${h.neden})`); return 'bitti'; }
      if (anahtarHatasiMi(h)) { gunluk(`API anahtarı hatası (${h.neden}): ${h.message}`); return 'anahtar'; }
      if (kotaHatasiMi(h)) { gunluk(`YouTube kotası doldu (${h.neden}); ${Math.round(kotaBekleme / 60000)} dk bekleniyor`); await uyu(kotaBekleme, sinyal); continue; }
      const kod = h instanceof YoutubeHatasi ? ` (HTTP ${h.durum} / ${h.neden})` : '';
      gunluk(`sohbet okunamadı${kod}: ${h.message}; 10 sn sonra yeniden`); await uyu(10000, sinyal); continue;
    }
    sayfa = v.nextPageToken ?? sayfa;
    sayfaOkundu((v.items ?? []).length);
    if (!ilk) for (const item of v.items ?? []) { const o = mesajOlayi(item); if (o) await olayVer(o); }
    else gunluk(`sohbete bağlanıldı; açılıştaki ${(v.items ?? []).length} eski mesaj atlandı`);
    ilk = false;
    if (v.offlineAt) { gunluk('yayın çevrimdışı oldu'); return 'bitti'; }
    await uyu(Math.max(enAzAralik, Number(v.pollingIntervalMillis) || 0), sinyal);
  }
  return 'durduruldu';
}
