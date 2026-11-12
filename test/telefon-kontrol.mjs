// telefon.html'i iPhone benzetimiyle açar; YouTube ve Gemini isteklerini sahte yanıtlara yönlendirir.
// Çalıştır: node test/telefon-kontrol.mjs   (Playwright gerekir; ~45 sn sürer, beğeni 30 sn'de bir okunur)
import { createRequire } from 'node:module';
import http from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { chromium, devices } = require('playwright');
const kok = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const cikti = path.join(kok, 'ekran');
await mkdir(cikti, { recursive: true });

// yalnız 127.0.0.1, yalnız sayfa dosyaları (GitHub Pages benzeri statik sunucu)
const TUR = { '.html': 'text/html; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8' };
const IZINLI = new Set(['index.html', 'telefon.html', 'telefon.mjs', 'youtube.mjs', 'ortak.mjs', 'beyin-cekirdek.mjs']);
const sunucu = http.createServer(async (q, r) => {
  const ad = decodeURIComponent(new URL(q.url, 'http://x').pathname.slice(1)) || 'index.html';
  if (!IZINLI.has(ad)) { r.writeHead(404); r.end(); return; }
  r.writeHead(200, { 'content-type': TUR[path.extname(ad)] }); r.end(await readFile(path.join(kok, ad)));
});
await new Promise((ok) => sunucu.listen(0, '127.0.0.1', ok));
const ADRES = `http://127.0.0.1:${sunucu.address().port}`;

let hata = 0;
const dogrula = (ad, kosul, ayrinti = '') => { console.log(`${kosul ? 'GEÇTİ ' : 'KALDI '} ${ad}${ayrinti ? '  (' + ayrinti + ')' : ''}`); if (!kosul) hata++; };
const bekle = (ms) => new Promise((r) => setTimeout(r, ms));

const YT = 'TEST-YT-ANAHTAR', GEM = 'TEST-GEM-ANAHTAR';
const istekler = [];
const mesaj = (ad, type, ek = {}) => ({ snippet: { type, ...ek }, authorDetails: { displayName: ad } });
const metin = (ad, m) => mesaj(ad, 'textMessageEvent', { textMessageDetails: { messageText: m } });
const halaycilar = ['Ayşe', 'Mehmet', 'Zeynep', 'Ali', 'Elif', 'Mustafa', 'Fatma', 'Emre', 'Hatice', 'Burak', 'Derya'];
const sayfalar = [
  { items: [metin('EskiMesaj', 'HALAY')] },
  { items: [...halaycilar.map((a) => metin(a, 'HALAY')), metin('Cem', 'Ege havası çalsın, efeler meydana!'),
    mesaj('Mehmet', 'superChatEvent', { superChatDetails: { amountDisplayString: '₺50,00' } })] },
];
let begeni = 1000, sohbetIstek = 0;

const tarayici = await chromium.launch();
const baglam = await tarayici.newContext({ ...devices['iPhone 13'] });
const sayfa = await baglam.newPage();
const konsol = [];
sayfa.on('pageerror', (e) => konsol.push('pageerror: ' + e.message));
sayfa.on('console', (m) => { if (m.type() === 'error') konsol.push(m.text()); });
sayfa.on('dialog', (d) => { konsol.push('dialog: ' + d.message()); d.dismiss(); });

await sayfa.route('https://www.googleapis.com/youtube/v3/**', async (route) => {
  const u = new URL(route.request().url());
  istekler.push({ url: u.href, anahtar: route.request().headers()['x-goog-api-key'] });
  let govde;
  if (u.pathname.endsWith('/videos')) {
    govde = { items: [{ snippet: { title: 'Deneme Yayını' }, liveStreamingDetails: { activeLiveChatId: 'SOHBET' }, statistics: { likeCount: String(begeni) } }] };
    begeni += 45;
  } else {
    govde = { nextPageToken: 'P' + sohbetIstek, pollingIntervalMillis: 2000, ...(sayfalar[sohbetIstek] ?? { items: [] }) };
    sohbetIstek++;
  }
  await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(govde) });
});
await sayfa.route('https://generativelanguage.googleapis.com/**', async (route) => {
  istekler.push({ url: route.request().url(), anahtar: route.request().headers()['x-goog-api-key'] });
  await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' },
    body: JSON.stringify({ candidates: [{ content: { parts: [{ text: '{"hareket":"zeybek","tempo":"ayni","soz":"Efeler meydana!"}' }] } }] }) });
});

// 1. kısa adres yönlendirir, kurulum ekranı görünür
await sayfa.goto(ADRES + '/telefon.html');
await sayfa.waitForSelector('#tKurulum', { timeout: 5000 });
dogrula('telefon.html → oyun + kurulum ekranı', sayfa.url().includes('telefon=1') && await sayfa.isVisible('#tKurulum'), sayfa.url().replace(ADRES, ''));
dogrula('deneme paneli gizli', !(await sayfa.isVisible('#panel')));
dogrula('anahtar alanları parola tipinde', (await sayfa.getAttribute('#tYt', 'type')) === 'password' && (await sayfa.getAttribute('#tGem', 'type')) === 'password');
await sayfa.click('#tBasla');
dogrula('anahtarsız Başla uyarı verir', (await sayfa.textContent('#tMesaj')).includes('anahtar'));
await sayfa.screenshot({ path: path.join(cikti, 'telefon-kurulum.png') });

// 2. bilgileri gir, başla
await sayfa.fill('#tYt', YT);
await sayfa.fill('#tGem', GEM);
await sayfa.fill('#tYayin', 'https://www.youtube.com/live/jfKfPfyJRdk?si=paylas');
await sayfa.click('#tBasla');
await bekle(800);
dogrula('Başla sonrası kurulum kapanır', !(await sayfa.isVisible('#tKurulum')));
dogrula('ayarlar bu telefonda saklandı', (await sayfa.evaluate(() => localStorage.getItem('obsHalayTelefon') || '')).includes(YT));

// 3. ilk sohbet sayfası atlanır; 5 sn sonra ikinci sayfa işlenir
await bekle(6500);
let d = await sayfa.evaluate(() => oyunDurumu());
dogrula('açılıştaki eski mesaj atlandı', !d.adlar.includes('EskiMesaj'), d.adlar.join(','));
dogrula('11 HALAY yazan sıraya girdi', d.avatar === 11, 'avatar=' + d.avatar);
dogrula('Super Chat gönderen halay başı', d.basi === 'Mehmet' && d.adlar[0] === 'Mehmet', 'başı=' + d.basi);
dogrula('serbest yorum Gemini ile dansı değiştirdi', d.dans === 'zeybek', 'dans=' + d.dans);
dogrula('Gemini sözü balonda', d.balon === 'Efeler meydana!' || d.balon?.includes('Mehmet'), 'balon=' + d.balon);
const yz = istekler.find((i) => i.url.includes('generativelanguage'));
dogrula('Gemini isteği gitti, anahtar başlıkta', !!yz && yz.anahtar === GEM);
await sayfa.screenshot({ path: path.join(cikti, 'telefon-oyun.png') });

// 4. beğeni 30 sn'de bir: 1000 → 1045 ⇒ +45 ⇒ tempo orta → hizli
const tempo0 = d.tempo;
await bekle(31000);
d = await sayfa.evaluate(() => oyunDurumu());
dogrula('beğeni artışı tempoyu yükseltti', tempo0 === 'orta' && d.tempo === 'hizli' && d.begeniToplam === 45, `${tempo0}→${d.tempo}, beğeni=${d.begeniToplam}`);

// 5. anahtar hiçbir isteğin adresinde yok
dogrula('anahtar hiçbir adreste yok, hep başlıkta', istekler.length > 3 && istekler.every((i) => !i.url.includes(YT) && !i.url.includes(GEM) && (i.anahtar === YT || i.anahtar === GEM)), istekler.length + ' istek');

// 6. çift dokunuş ayarları açar; sil düğmesi depoyu boşaltır
await sayfa.mouse.click(200, 500); await sayfa.mouse.click(200, 500);
await bekle(300);
dogrula('çift dokunuş ayarları açar', await sayfa.isVisible('#tKurulum'));
const k1 = await sayfa.textContent('#tDurumMetni');
dogrula('başarılı akışta sayaçlar doluyor, hata yok', /gelen mesaj: 1[0-9]/.test(k1) && /oyuna giden olay: [1-9]/.test(k1) && k1.includes('Son hata: yok'), k1.replace(/\n/g, ' | '));
await sayfa.click('#tSil');
dogrula('"Anahtarları sil" depoyu boşaltır', (await sayfa.evaluate(() => localStorage.getItem('obsHalayTelefon'))) === null && (await sayfa.inputValue('#tYt')) === '');

dogrula('konsol hatası yok', konsol.length === 0, konsol.join(' | '));

// 7. teşhis: sohbet okuma 401 ile reddedilirse hata ekranda kalır ve "Son durum" kutusunda görünür
const s2 = await (await tarayici.newContext({ ...devices['iPhone 13'] })).newPage();
await s2.route('https://www.googleapis.com/youtube/v3/**', async (route) => {
  const u = new URL(route.request().url());
  if (u.pathname.endsWith('/videos'))
    return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' },
      body: JSON.stringify({ items: [{ snippet: { title: 'Deneme' }, liveStreamingDetails: { activeLiveChatId: 'S' }, statistics: { likeCount: '1' } }] }) });
  return route.fulfill({ status: 401, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' },
    body: JSON.stringify({ error: { code: 401, message: 'Login Required.', errors: [{ reason: 'required', message: 'Login Required.' }], status: 'UNAUTHENTICATED' } }) });
});
await s2.goto(ADRES + '/telefon.html');
await s2.waitForSelector('#tBasla');
await s2.fill('#tYt', YT); await s2.fill('#tYayin', 'jfKfPfyJRdk'); await s2.click('#tBasla');
await bekle(8000); // 5 sn'lik solma süresinden uzun bekle
const serit = await s2.evaluate(() => { const e = document.getElementById('tDurum'); return { metin: e.textContent, hata: e.classList.contains('hata'), gorunur: getComputedStyle(e).opacity === '1' }; });
dogrula('401 hatası şeritte kalıcı', serit.hata && serit.gorunur && serit.metin.includes('HTTP 401 / required'), serit.metin);
await s2.mouse.click(200, 500); await s2.mouse.click(200, 500); await bekle(300);
const kutu = await s2.textContent('#tDurumMetni');
dogrula('"Son durum" kutusunda HTTP kodu ve neden var', kutu.includes('HTTP 401 / required') && kutu.includes('Login Required'), kutu.replace(/\n/g, ' | '));
dogrula('durum kutusunda anahtar yok', !kutu.includes(YT));
await s2.screenshot({ path: path.join(cikti, 'telefon-teshis.png') });

await tarayici.close();
sunucu.close();
console.log(hata ? `\n${hata} denetim KALDI` : '\nTüm telefon denetimleri geçti');
process.exit(hata ? 1 : 0);
