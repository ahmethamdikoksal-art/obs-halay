// iPhone (ve her tarayıcı) için köprüsüz YouTube sürümü.
// index.html?telefon=1 açılınca yüklenir: YouTube sohbetini ve Gemini'yi doğrudan tarayıcıdan çağırır,
// sonuçları oyunun tek giriş kapısı window.olay(...)'a verir.
// Anahtarlar yalnız bu cihazın tarayıcısında (localStorage) durur; yalnız Google'a, başlıkta gider.
import { videoKimligi, videoBilgisi, sohbetOku, BegeniSayaci, anahtarHatasiMi, kotaHatasiMi, EN_AZ_ARALIK_MS } from './youtube.mjs';
import { HizSiniri, yorumuCevir } from './ortak.mjs';
import { yorumla } from './beyin-cekirdek.mjs';

const DEPO = 'obsHalayTelefon';
const BEGENI_ARALIK_MS = 30000;

// ---------- güvenli depolama (gizli sekmede ya da kapalıysa sessizce geçer) ----------
function ayarOku() {
  try { return JSON.parse(localStorage.getItem(DEPO) || '{}') || {}; } catch { return {}; }
}
function ayarYaz(a) { try { localStorage.setItem(DEPO, JSON.stringify(a)); return true; } catch { return false; } }
function ayarSil() { try { localStorage.removeItem(DEPO); } catch {} }

// ---------- arayüz ----------
const stil = document.createElement('style');
stil.textContent = `
  #tKurulum { position: fixed; inset: 0; z-index: 10; overflow-y: auto; background: rgba(12,14,20,.94); color: #eee;
    font: 16px/1.4 -apple-system, "Segoe UI", system-ui, sans-serif; padding: max(16px, env(safe-area-inset-top)) 16px 32px; box-sizing: border-box; }
  #tKurulum .kutu { max-width: 460px; margin: 0 auto; }
  #tKurulum h1 { font-size: 24px; margin: 8px 0 4px; color: #ffd23f; }
  #tKurulum p { margin: 4px 0 12px; color: #b8bcc8; font-size: 14px; }
  #tKurulum label { display: block; margin: 14px 0 4px; font-size: 14px; color: #cfd3dd; }
  #tKurulum input[type=text], #tKurulum input[type=password], #tKurulum input[type=number] { width: 100%; box-sizing: border-box; padding: 12px;
    font-size: 16px; border-radius: 10px; border: 1px solid #444; background: #0b0d12; color: #fff; }
  #tKurulum .satir { display: flex; align-items: center; gap: 8px; margin-top: 14px; font-size: 14px; }
  #tKurulum button { width: 100%; padding: 14px; margin-top: 16px; font-size: 18px; font-weight: 700; border: 0; border-radius: 12px; background: #e8142c; color: #fff; }
  #tKurulum button.ikincil { background: #333; font-size: 15px; font-weight: 600; }
  #tKurulum .mesaj { margin-top: 12px; min-height: 20px; color: #ff8a8a; font-size: 14px; }
  #tDurum { position: fixed; left: 50%; top: max(6px, env(safe-area-inset-top)); transform: translateX(-50%); z-index: 9; max-width: 92vw;
    padding: 6px 12px; border-radius: 999px; background: rgba(0,0,0,.72); color: #fff; font: 13px -apple-system, system-ui, sans-serif;
    transition: opacity .6s; pointer-events: none; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  #tDurum.hata { background: rgba(150,20,30,.85); white-space: normal; }
  #tDurumKutu { margin-top: 16px; padding: 10px 12px; border-radius: 10px; background: #0b0d12; border: 1px solid #333;
    font: 13px/1.5 ui-monospace, Menlo, monospace; color: #cfd3dd; white-space: pre-wrap; word-break: break-word; }
  #tDurumKutu .baslik { font: 600 13px -apple-system, system-ui, sans-serif; color: #9cf; margin-bottom: 4px; }
`;
document.head.appendChild(stil);

function el(etiket, ozellik = {}, ...cocuk) {
  const e = document.createElement(etiket);
  for (const [k, v] of Object.entries(ozellik)) {
    if (k === 'text') e.textContent = v; else if (k in e) e[k] = v; else e.setAttribute(k, v);
  }
  for (const c of cocuk) e.append(c);
  return e;
}

const kayitli = ayarOku();
const yt = el('input', { type: 'password', id: 'tYt', autocomplete: 'off', spellcheck: false, value: kayitli.yt || '', placeholder: 'AIza…' });
const gem = el('input', { type: 'password', id: 'tGem', autocomplete: 'off', spellcheck: false, value: kayitli.gemini || '', placeholder: 'boş bırakılabilir' });
const yayin = el('input', { type: 'text', id: 'tYayin', autocomplete: 'off', spellcheck: false, value: kayitli.yayin || '', placeholder: 'https://www.youtube.com/live/…' });
const aralik = el('input', { type: 'number', id: 'tAralik', min: 5, max: 60, value: kayitli.aralik || 5 });
const hatirla = el('input', { type: 'checkbox', id: 'tHatirla', checked: kayitli.hatirla !== false });
const mesaj = el('div', { className: 'mesaj', id: 'tMesaj' });
const basla = el('button', { id: 'tBasla', text: '▶ Başla' });
const sil = el('button', { id: 'tSil', className: 'ikincil', text: 'Anahtarları bu telefondan sil' });
const durumMetni = el('div', { id: 'tDurumMetni', text: 'Henüz başlatılmadı.' });
const durumKutu = el('div', { id: 'tDurumKutu' }, el('div', { className: 'baslik', text: 'Son durum (sorun olursa bu kutunun ekran görüntüsünü gönder)' }), durumMetni);

const kurulum = el('div', { id: 'tKurulum' }, el('div', { className: 'kutu' },
  el('h1', { text: 'Online Halay · YouTube' }),
  el('p', { text: 'Anahtarlar yalnız bu telefonda saklanır ve yalnız Google\'a gider. Başladıktan sonra ayarlara dönmek için ekrana çift dokun.' }),
  el('label', { htmlFor: 'tYt', text: 'YouTube Data API anahtarı' }), yt,
  el('label', { htmlFor: 'tGem', text: 'Gemini anahtarı (serbest yorumlar için, isteğe bağlı)' }), gem,
  el('label', { htmlFor: 'tYayin', text: 'Canlı yayın adresi' }), yayin,
  el('label', { htmlFor: 'tAralik', text: 'Sohbet okuma aralığı (saniye, en az 5; büyük = daha az kota)' }), aralik,
  el('div', { className: 'satir' }, hatirla, el('label', { htmlFor: 'tHatirla', text: 'Bu telefonda hatırla', style: 'margin:0' })),
  basla, mesaj, durumKutu, sil,
));
const durumSerit = el('div', { id: 'tDurum', style: 'opacity:0' });
document.body.append(kurulum, durumSerit);

// ---------- teşhis: son durum, sayaçlar, son hata (anahtar asla yazılmaz) ----------
const teshis = { son: '', sayfa: 0, mesaj: 0, olay: 0, hata: '', hataSaati: '' };
const saat = () => new Date().toLocaleTimeString('tr-TR');
function teshisYaz() {
  durumMetni.textContent =
    `Son: ${teshis.son || '-'}\n` +
    `Okunan sohbet sayfası: ${teshis.sayfa} · gelen mesaj: ${teshis.mesaj} · oyuna giden olay: ${teshis.olay}\n` +
    `Son hata: ${teshis.hata ? teshis.hataSaati + ' ' + teshis.hata : 'yok'}\n` +
    `Ses: ${window.sesDurumu?.() ?? '?'}`;
}
setInterval(teshisYaz, 2000);

let solTimer = null;
// hata=true: şerit hata düzelene kadar ekranda kalır
function durum(metin, hata = false) {
  teshis.son = saat() + ' ' + metin;
  if (hata) { teshis.hata = metin; teshis.hataSaati = saat(); }
  teshisYaz();
  durumSerit.textContent = metin;
  durumSerit.classList.toggle('hata', hata);
  durumSerit.style.opacity = '1';
  clearTimeout(solTimer);
  if (!hata) solTimer = setTimeout(() => { durumSerit.style.opacity = '0'; }, 5000);
}
function hataTemizle() {
  if (durumSerit.classList.contains('hata')) { durumSerit.classList.remove('hata'); durumSerit.style.opacity = '0'; }
}

// ---------- ekran kararmasın ----------
let kilit = null;
async function ekranAcikKalsin() {
  try {
    if ('wakeLock' in navigator) { kilit = await navigator.wakeLock.request('screen'); return true; }
  } catch {}
  return false;
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && calisma) ekranAcikKalsin(); });

// ---------- YouTube döngüsü ----------
let calisma = null; // AbortController

function uyu(ms, sinyal) {
  return new Promise((ok) => {
    const t = setTimeout(ok, ms);
    sinyal.addEventListener('abort', () => { clearTimeout(t); ok(); }, { once: true });
  });
}

async function calistir({ ytAnahtar, gemAnahtar, videoId, araMs }, sinyal) {
  const sinir = new HizSiniri();
  const begeni = new BegeniSayaci();
  const yz = (metin, ad) => yorumla(metin, ad, { anahtar: gemAnahtar });
  const olayVer = async (o) => {
    if (o.tur === 'yorum') {
      const c = await yorumuCevir(o.ad, o.metin, sinir, yz);
      if (c) { window.olay({ ...c, zaman: Date.now() }); teshis.olay++; teshisYaz(); }
      return;
    }
    window.olay(o); teshis.olay++; teshisYaz();
  };
  let begeniBasladi = false;
  const begeniDongusu = async () => {
    while (!sinyal.aborted) {
      await uyu(BEGENI_ARALIK_MS, sinyal);
      if (sinyal.aborted) return;
      try { const o = begeni.guncelle((await videoBilgisi(fetch, ytAnahtar, videoId)).begeni); if (o) window.olay(o); }
      catch (e) { if (kotaHatasiMi(e)) { durum('YouTube kotası doldu; beğeniler 15 dk duraklatıldı', true); await uyu(15 * 60000, sinyal); } }
    }
  };

  while (!sinyal.aborted) {
    let bilgi;
    try {
      bilgi = await videoBilgisi(fetch, ytAnahtar, videoId);
    } catch (e) {
      if (anahtarHatasiMi(e)) { ayarlariAc('YouTube anahtarı reddedildi: ' + e.neden + '. Google Cloud\'da YouTube Data API v3 açık mı, anahtar kısıtı doğru mu?'); return; }
      durum(kotaHatasiMi(e) ? 'YouTube kotası doldu; 15 dk sonra yeniden' : `Video bilgisi alınamadı (HTTP ${e.durum ?? '?'} / ${e.neden ?? e.name}): ${e.message}; 60 sn sonra yeniden`, true);
      await uyu(kotaHatasiMi(e) ? 15 * 60000 : 60000, sinyal); continue;
    }
    if (!bilgi.sohbetId) { durum(`"${bilgi.baslik}" canlı değil ya da sohbeti kapalı; 60 sn sonra yeniden bakılacak`, true); await uyu(60000, sinyal); continue; }
    begeni.guncelle(bilgi.begeni);
    if (!begeniBasladi) { begeniBasladi = true; begeniDongusu(); }
    durum(bilgi.begeni === null ? 'Sohbete bağlanılıyor (beğeni sayısı gizli: 40 beğeni kuralı çalışmaz)' : 'Sohbete bağlanılıyor');
    const sonuc = await sohbetOku({
      anahtar: ytAnahtar, sohbetId: bilgi.sohbetId, olayVer, sinyal, enAzAralik: araMs,
      uyu: (ms) => uyu(ms, sinyal),
      gunluk: (m) => {
        if (/^sohbete bağlanıldı/.test(m)) { hataTemizle(); durum('Sohbet bağlı ✓ (' + m + ')'); }
        else durum(m, /okunamadı|hatası|kotası|kapandı|çevrimdışı/.test(m));
      },
      sayfaOkundu: (n) => { teshis.sayfa++; teshis.mesaj += n; if (teshis.hata && teshis.sayfa) { teshis.hata = ''; hataTemizle(); } teshisYaz(); },
    });
    if (sonuc === 'anahtar') { ayarlariAc('YouTube anahtarı reddedildi. Anahtarı ve kısıtlarını kontrol et.'); return; }
    if (sonuc === 'bitti') { durum('Sohbet kapandı; 60 sn sonra yeniden bakılacak', true); await uyu(60000, sinyal); }
  }
}

function ayarlariAc(hata = '') {
  mesaj.textContent = hata;
  teshisYaz(); // açılır açılmaz güncel durumu göster (2 sn'lik yenilemeyi bekleme)
  if (hata) { teshis.hata = hata; teshis.hataSaati = saat(); teshisYaz(); }
  basla.textContent = calisma && !calisma.signal.aborted ? '↻ Yeniden başlat' : '▶ Başla';
  kurulum.style.display = '';
}

basla.addEventListener('click', async () => {
  // ses Safari'de yalnız dokunuşun içinde açılabilir: önce onu yap
  try { window.sesBaslat?.(); } catch {}
  const ytAnahtar = yt.value.trim();
  const gemAnahtar = gem.value.trim();
  const videoId = videoKimligi(yayin.value);
  const araSn = Math.min(60, Math.max(EN_AZ_ARALIK_MS / 1000, Math.round(Number(aralik.value) || 5)));
  if (!ytAnahtar) { mesaj.textContent = 'YouTube API anahtarını yaz.'; return; }
  if (!videoId) { mesaj.textContent = 'Yayın adresi tanınmadı. YouTube Studio\'daki paylaşım adresini yapıştır.'; return; }
  mesaj.textContent = '';
  if (hatirla.checked) {
    if (!ayarYaz({ yt: ytAnahtar, gemini: gemAnahtar, yayin: yayin.value.trim(), aralik: araSn, hatirla: true }))
      durum('Ayarlar bu tarayıcıda kaydedilemedi (gizli sekme?); yalnız bu oturum için geçerli');
  } else ayarSil();
  calisma?.abort();
  calisma = new AbortController();
  Object.assign(teshis, { sayfa: 0, mesaj: 0, olay: 0, hata: '' });
  durum('Başlatıldı: video ' + videoId);
  kurulum.style.display = 'none';
  if (!(await ekranAcikKalsin())) durum('Uyarı: ekran kararmasını engelleyemedim. Ayarlar > Ekran ve Parlaklık > Otomatik Kilit: Asla');
  calistir({ ytAnahtar, gemAnahtar, videoId, araMs: araSn * 1000 }, calisma.signal);
});

sil.addEventListener('click', () => {
  ayarSil();
  yt.value = ''; gem.value = '';
  mesaj.textContent = 'Anahtarlar bu telefondan silindi.';
});

// başladıktan sonra çift dokunuş ayarları açar
let sonDokunus = 0;
document.addEventListener('pointerup', (e) => {
  if (kurulum.style.display !== 'none' || e.target.closest?.('#tKurulum')) return;
  const simdi = Date.now();
  if (simdi - sonDokunus < 350) ayarlariAc();
  sonDokunus = simdi;
});

window.telefonHazir = true;
