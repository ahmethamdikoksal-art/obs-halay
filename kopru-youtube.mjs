// YouTube canlı yayın sohbetini OKUR (YouTube Data API v3, yalnız API anahtarı), ws ile 127.0.0.1'e yollar.
// Yayına hiçbir şey yazmaz; OAuth, şifre ya da çerez kullanmaz.
// Kullanım: node kopru-youtube.mjs [yayin_adresi_ya_da_video_kimligi]   (ya da .env içinde YOUTUBE_YAYIN)
import 'dotenv/config';
import { sunucuAc, HOST } from './sunucu.mjs';
import { HizSiniri, yorumuCevir } from './ortak.mjs';
import { yorumla } from './beyin.mjs';
import { videoKimligi, videoBilgisi, sohbetOku, BegeniSayaci, anahtarHatasiMi, kotaHatasiMi } from './youtube.mjs';

const PORT = Number(process.env.WS_PORT) || 8765;
const BEGENI_ARALIK_MS = 30000;
// sohbet okuma aralığı (sn): kısa = daha anlık ama daha çok kota; YouTube daha uzun önerirse onunki geçerli
const ARALIK_MS = Math.max(5, Number(process.env.YOUTUBE_ARALIK_SN) || 5) * 1000;
const anahtar = String(process.env.YOUTUBE_API_KEY || '').trim();
const yayinGirdi = String(process.argv[2] || process.env.YOUTUBE_YAYIN || '').trim();
const videoId = videoKimligi(yayinGirdi);

const yaz = (...a) => console.log(`[${new Date().toLocaleTimeString('tr-TR')}]`, ...a);

const sunucu = sunucuAc(PORT);
try { await sunucu.hazir; } catch (e) { console.error(e.message); process.exit(1); }
yaz(`sayfa: ${sunucu.adres}?temiz=1&platform=youtube   ws: ws://${HOST}:${PORT}`);
sunucu.wss.on('connection', (ws, req) => yaz(`sayfa bağlandı (${req.socket.remoteAddress}), toplam ${sunucu.wss.clients.size}`));

const durdur = new AbortController();
const sinir = new HizSiniri();
const begeni = new BegeniSayaci();
const uyu = (ms) => new Promise((ok) => {
  const t = setTimeout(ok, ms);
  durdur.signal.addEventListener('abort', () => { clearTimeout(t); ok(); }, { once: true });
});

async function olayVer(o) {
  if (o.tur === 'yorum') {
    try {
      const c = await yorumuCevir(o.ad, o.metin, sinir, yorumla);
      if (c) { sunucu.yolla(c); yaz(`yorum ${o.ad}: "${o.metin.slice(0, 60)}" → ${c.tur === 'yapay' ? `YZ ${c.hareket}/${c.tempo}` : 'kural'}`); }
    } catch (e) { yaz('yorum işlenemedi:', e.message); }
    return;
  }
  sunucu.yolla(o);
  if (o.tur === 'hediye') yaz(`hediye ${o.ad}: ${o.adet} x ${o.metin}`);
}

async function begeniDongusu() {
  while (!durdur.signal.aborted) {
    await uyu(BEGENI_ARALIK_MS);
    if (durdur.signal.aborted) break;
    try {
      const o = begeni.guncelle((await videoBilgisi(fetch, anahtar, videoId)).begeni);
      if (o) { sunucu.yolla(o); yaz(`beğeni +${o.adet} (toplam ${begeni.son})`); }
    } catch (e) {
      yaz(`beğeni okunamadı: ${e.message}`);
      if (kotaHatasiMi(e)) await uyu(15 * 60000);
    }
  }
}

async function baslat() {
  if (!anahtar || !videoId) {
    if (!anahtar) yaz('YOUTUBE_API_KEY yok: .env dosyasına yaz.');
    if (!videoId) yaz(`Yayın tanınmadı${yayinGirdi ? ` ("${yayinGirdi.slice(0, 80)}")` : ''}: .env içine YOUTUBE_YAYIN=https://youtube.com/live/... yaz ya da: node kopru-youtube.mjs <adres>`);
    yaz('Köprü yalnız ws sunucusu olarak çalışıyor (deneme paneli ve sahte-test için).');
    return;
  }
  let begeniBasladi = false;
  while (!durdur.signal.aborted) {
    let bilgi;
    try {
      bilgi = await videoBilgisi(fetch, anahtar, videoId);
    } catch (e) {
      if (anahtarHatasiMi(e)) { yaz(`API anahtarı reddedildi (${e.neden}): ${e.message}`); yaz('Google Cloud\'da YouTube Data API v3 açık mı, anahtar bu API\'ye izinli mi? Okuma durdu.'); return; }
      yaz(`video bilgisi alınamadı (${e.neden}): ${e.message}; 60 sn sonra yeniden`);
      await uyu(kotaHatasiMi(e) ? 15 * 60000 : 60000); continue;
    }
    if (!bilgi.sohbetId) { yaz(`"${bilgi.baslik}" şu anda canlı değil ya da sohbeti kapalı; 60 sn sonra yeniden`); await uyu(60000); continue; }
    yaz(`"${bilgi.baslik}" yayınına bağlanılıyor (sohbet en az ${ARALIK_MS / 1000} sn'de bir okunur)`);
    begeni.guncelle(bilgi.begeni);
    if (bilgi.begeni === null) yaz('Bu videoda beğeni sayısı gizli: 40 beğeni kuralı çalışmaz.');
    if (!begeniBasladi) { begeniBasladi = true; begeniDongusu(); }
    const sonuc = await sohbetOku({ anahtar, sohbetId: bilgi.sohbetId, olayVer, sinyal: durdur.signal, uyu: (ms) => uyu(ms), gunluk: yaz, enAzAralik: ARALIK_MS });
    if (sonuc === 'anahtar') return;
    if (sonuc === 'bitti') { yaz('60 sn sonra yeniden denenecek'); await uyu(60000); }
  }
}

let kapaniyor = false;
async function kapat() {
  if (kapaniyor) return;
  kapaniyor = true;
  yaz('kapatılıyor...');
  durdur.abort();
  setTimeout(() => process.exit(0), 2000).unref();
  await sunucu.kapat();
  yaz('kapandı');
  process.exit(0);
}
process.on('SIGINT', kapat);
process.on('SIGTERM', kapat);

baslat();
