// TikTok canlı yayınından yorum, beğeni ve hediyeyi OKUR, ws ile 127.0.0.1'e yollar.
// Yayına hiçbir şey yazmaz; şifre ya da çerez kullanmaz.
// Kullanım: node kopru.mjs [tiktok_kullanici_adi]   (ya da .env içinde TIKTOK_KULLANICI)
import 'dotenv/config';
import { sunucuAc, HOST } from './sunucu.mjs';
import { TikTokLiveConnection, WebcastEvent, ControlEvent } from 'tiktok-live-connector';
import { HizSiniri, hediyeOlayi, begeniOlayi, kisiAdi, yorumuCevir } from './ortak.mjs';
import { yorumla } from './beyin.mjs';

const PORT = Number(process.env.WS_PORT) || 8765;
const kullanici = String(process.argv[2] || process.env.TIKTOK_KULLANICI || '').replace(/^@/, '').trim();

const zaman = () => new Date().toLocaleTimeString('tr-TR');
const yaz = (...a) => console.log(`[${zaman()}]`, ...a);

// ---- sayfa + ws sunucusu (yalnız 127.0.0.1) ----
const sunucu = sunucuAc(PORT);
const { wss, yolla } = sunucu;
try {
  await sunucu.hazir;
} catch (e) { console.error(e.message); process.exit(1); }
yaz(`sayfa: ${sunucu.adres}?temiz=1   ws: ws://${HOST}:${PORT}`);
wss.on('connection', (ws, req) => yaz(`sayfa bağlandı (${req.socket.remoteAddress}), toplam ${wss.clients.size}`));

// ---- TikTok (yalnız okuma) ----
const sinir = new HizSiniri();
let baglanti = null;
let kapaniyor = false;
let bekleme = null;

function yeniden(ms) {
  if (kapaniyor) return;
  clearTimeout(bekleme);
  yaz(`${Math.round(ms / 1000)} sn sonra yeniden denenecek`);
  bekleme = setTimeout(baslat, ms);
}

async function baslat() {
  if (!kullanici) {
    yaz('TikTok kullanıcı adı yok. .env içine TIKTOK_KULLANICI yaz ya da: node kopru.mjs kullanici_adi');
    yaz('Köprü yalnız ws sunucusu olarak çalışıyor (deneme paneli ve sahte-test için).');
    return;
  }
  baglanti = new TikTokLiveConnection(kullanici, {});

  baglanti.on(WebcastEvent.CHAT, async (d) => {
    const ad = kisiAdi(d.user);
    const metin = String(d.comment || '');
    try {
      const o = await yorumuCevir(ad, metin, sinir, yorumla);
      if (o) { yolla(o); yaz(`yorum ${ad}: "${metin.slice(0, 60)}" → ${o.tur === 'yapay' ? `YZ ${o.hareket}/${o.tempo}` : 'kural'}`); }
    } catch (e) { yaz('yorum işlenemedi:', e.message); }
  });

  baglanti.on(WebcastEvent.LIKE, (d) => { const o = begeniOlayi(d); yolla(o); });

  baglanti.on(WebcastEvent.GIFT, (d) => {
    const o = hediyeOlayi(d); // seri sürerken (repeatEnd yok) null: sayılmaz
    if (!o) return;
    yolla(o);
    yaz(`hediye ${o.ad}: ${o.adet} x ${o.metin}`);
  });

  baglanti.on(WebcastEvent.STREAM_END, () => { yaz('yayın bitti'); yeniden(30000); });
  baglanti.on(ControlEvent.DISCONNECTED, () => { yaz('TikTok bağlantısı koptu'); yeniden(10000); });
  baglanti.on(ControlEvent.ERROR, (e) => yaz('TikTok hata:', e?.info || e?.exception?.message || e));

  try {
    const st = await baglanti.connect();
    yaz(`@${kullanici} yayınına bağlandı (oda ${st.roomId})`);
  } catch (e) {
    const neden = e?.constructor?.name === 'UserOfflineError' ? 'yayında değil' : (e?.message || String(e));
    yaz(`@${kullanici} yayınına bağlanılamadı: ${neden}`);
    yeniden(30000);
  }
}

async function kapat() {
  if (kapaniyor) return;
  kapaniyor = true;
  clearTimeout(bekleme);
  yaz('kapatılıyor...');
  try { await baglanti?.disconnect(); } catch {}
  setTimeout(() => process.exit(0), 2000).unref();
  await sunucu.kapat();
  yaz('kapandı');
  process.exit(0);
}
process.on('SIGINT', kapat);
process.on('SIGTERM', kapat);

baslat();
