// index.html'i gerçek Chromium'da açar, kuralları ve sınırları denetler, ekran görüntüsü alır.
// Çalıştır: node test/sayfa-kontrol.mjs   (Playwright gerekir)
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { kuralKomutu } from '../ortak.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const kok = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const adres = pathToFileURL(path.join(kok, 'index.html')).href;
const cikti = path.join(kok, 'ekran');
mkdirSync(cikti, { recursive: true });

let hata = 0;
const dogrula = (ad, kosul, ayrinti = '') => { console.log(`${kosul ? 'GEÇTİ ' : 'KALDI '} ${ad}${ayrinti ? '  (' + ayrinti + ')' : ''}`); if (!kosul) hata++; };

const tarayici = await chromium.launch();
const sayfa = await tarayici.newPage({ viewport: { width: 1400, height: 1000 } });
const konsol = [];
sayfa.on('pageerror', (e) => konsol.push('pageerror: ' + e.message));
sayfa.on('console', (m) => { if (m.type() === 'error' && !/WebSocket|ERR_CONNECTION_REFUSED/.test(m.text())) konsol.push(m.text()); });
await sayfa.goto(adres);
await sayfa.waitForTimeout(500);

// 1. kural eşliği: tarayıcıdaki kuralKomutu === ortak.mjs
const ornekler = ['HALAY', 'halaaay', 'HORON', 'Zeybek', 'HIZLI', 'coşkulu', 'yavaşla', 'orta', 'ortada', 'merhaba', 'Ege havası', 'horon hızlı'];
const sayfaSonuc = await sayfa.evaluate((o) => o.map((m) => kuralKomutu(m)), ornekler);
dogrula('kural eşliği (sayfa = ortak.mjs)', JSON.stringify(sayfaSonuc) === JSON.stringify(ornekler.map(kuralKomutu)));

// 2. 70 kişi HALAY yazar -> en çok 60 avatar
const n = await sayfa.evaluate(() => { for (let i = 0; i < 70; i++) olay({ tur: 'yorum', ad: 'kisi' + i, metin: 'HALAY' }); return oyunDurumu().avatar; });
dogrula('70 katılımda avatar sayısı 60', n === 60, 'avatar=' + n);

// 3. aynı kişi 3 sn içinde ikinci komut
const r = await sayfa.evaluate(() => [olay({ tur: 'yorum', ad: 'ayni', metin: 'HORON' }), olay({ tur: 'yorum', ad: 'ayni', metin: 'ZEYBEK' }), oyunDurumu().dans]);
dogrula('3 sn sınırı: ilk kabul, ikinci red', r[0].kabul && !r[1].kabul && r[2] === 'horon', JSON.stringify(r));
await sayfa.waitForTimeout(3050);
const r2 = await sayfa.evaluate(() => [olay({ tur: 'yorum', ad: 'ayni', metin: 'ZEYBEK' }).kabul, oyunDurumu().dans]);
dogrula('3 sn sonra yeniden kabul', r2[0] && r2[1] === 'zeybek', JSON.stringify(r2));

// 4. 40 beğenide tempo bir kademe
const t = await sayfa.evaluate(() => { const a = oyunDurumu().tempo; olay({ tur: 'begeni', ad: 'x', adet: 39 }); const b = oyunDurumu().tempo; olay({ tur: 'begeni', ad: 'x', adet: 1 }); return [a, b, oyunDurumu().tempo]; });
dogrula('39 beğeni tempo değişmez, 40.da orta→hizli', t.join() === 'orta,orta,hizli', t.join());

// 5. hediye -> halay başı, ilk sırada
const h = await sayfa.evaluate(() => { olay({ tur: 'hediye', ad: 'Comert', metin: 'Gül', adet: 5 }); const d = oyunDurumu(); return [d.basi, d.adlar[0], d.avatar]; });
dogrula('hediye gönderen halay başı ve ilk sırada', h[0] === 'Comert' && h[1] === 'Comert' && h[2] === 60, h.join());

// 6. listede olmayan değer atılır
const y = await sayfa.evaluate(() => { const once = oyunDurumu(); olay({ tur: 'yapay', ad: 'yz1', hareket: 'tango', tempo: 'turbo', soz: 'Merhaba!' }); const d = oyunDurumu(); return [once.dans === d.dans, once.tempo === d.tempo, d.balon]; });
dogrula('yapay: geçersiz hareket/tempo atıldı, söz gösterildi', y[0] && y[1] && y[2] === 'Merhaba!', JSON.stringify(y));
const g = await sayfa.evaluate(() => olay({ tur: 'sil', ad: 'x' }).kabul);
dogrula('bilinmeyen tur reddedilir', g === false);

// 8. ses: her dans doğru çalgıyla çalar, dans değişince ses kesilmez, notada hata olsa da döngü durmaz
await sayfa.click('button[data-k="ses"]');
await sayfa.evaluate(() => {
  window.say = { zurna: 0, kemence: 0, davul: 0 };
  const z = zurna, k = kemence, g = gum, t = tak;
  zurna = (...a) => { say.zurna++; z(...a); }; kemence = (...a) => { say.kemence++; k(...a); };
  gum = (...a) => { say.davul++; g(...a); }; tak = (...a) => { say.davul++; t(...a); };
});
const dinle = async (dans) => {
  await sayfa.evaluate((d) => { durum.dans = d; say.zurna = say.kemence = say.davul = 0; }, dans);
  await sayfa.waitForTimeout(2500);
  return sayfa.evaluate(() => ({ ...say, ses: sesDurumu() }));
};
const sonuclar = {};
for (const d of ['halay', 'horon', 'zeybek', 'horon']) sonuclar[d + Object.keys(sonuclar).length] = await dinle(d);
const [h0, r1, z2, r3] = Object.values(sonuclar);
dogrula('halay: zurna + davul, kemençe yok', h0.zurna > 0 && h0.davul > 0 && h0.kemence === 0, JSON.stringify(h0));
dogrula('horon: kemençe + davul, zurna yok', r1.kemence > 0 && r1.davul > 0 && r1.zurna === 0, JSON.stringify(r1));
dogrula('zeybek: zurna + davul, kemençe yok', z2.zurna > 0 && z2.davul > 0 && z2.kemence === 0, JSON.stringify(z2));
dogrula('zeybekten horona tekrar geçince ses sürüyor', r3.kemence > 0 && r3.davul > 0 && r3.ses === 'çalışıyor', JSON.stringify(r3));
const olcum = await sayfa.evaluate(async () => {
  const off = new OfflineAudioContext(1, 44100 * 2, 44100);
  const [c0, a0] = [ses.ctx, ses.ana];
  ses.ctx = off; ses.ana = off.destination;
  try { for (let i = 0; i < 14; i++) kemence(i * 0.14, NOTA_K['efgfefedcba'[i % 11]], 0.13); }
  finally { ses.ctx = c0; ses.ana = a0; }
  const v = (await off.startRendering()).getChannelData(0);
  let top = 0, tepe = 0; for (const x of v) { top += x * x; tepe = Math.max(tepe, Math.abs(x)); }
  return { rms: +Math.sqrt(top / v.length).toFixed(4), tepe: +tepe.toFixed(3) };
});
dogrula('kemençe sesi gerçekten ses üretiyor ve kırpılmıyor', olcum.rms > 0.005 && olcum.tepe < 1, JSON.stringify(olcum));
const dayaniklilik = await sayfa.evaluate(async () => {
  durum.dans = 'horon'; say.davul = 0;
  const k = kemence; kemence = () => { throw new Error('deneme hatası'); };
  await new Promise((r) => setTimeout(r, 1500));
  const sonuc = { davul: say.davul, ses: sesDurumu() };
  kemence = k; ses.sonHata = null;
  return sonuc;
});
dogrula('kemençede hata olsa da davul sürüyor, hata görünüyor', dayaniklilik.davul > 0 && dayaniklilik.ses.includes('deneme hatası'), JSON.stringify(dayaniklilik));
await sayfa.evaluate(() => { durum.dans = 'horon'; });

await sayfa.waitForTimeout(400);
await sayfa.screenshot({ path: path.join(cikti, 'panelli.png') });
await sayfa.locator('#sahne').screenshot({ path: path.join(cikti, 'tuval.png') });

// 7. ?temiz=1 panel gizli
const temiz = await tarayici.newPage({ viewport: { width: 540, height: 960 } });
temiz.on('pageerror', (e) => konsol.push('pageerror(temiz): ' + e.message));
await temiz.goto(adres + '?temiz=1');
await temiz.evaluate(() => { for (let i = 0; i < 25; i++) olay({ tur: 'yorum', ad: 'oyuncu' + i, metin: 'HALAY' }); });
await temiz.waitForTimeout(1500);
const gorunur = await temiz.locator('#panel').isVisible();
dogrula('?temiz=1 ile panel gizli', gorunur === false);
await temiz.screenshot({ path: path.join(cikti, 'temiz.png') });

dogrula('konsol hatası yok', konsol.length === 0, konsol.join(' | '));
await tarayici.close();
console.log(hata ? `\n${hata} denetim KALDI` : '\nTüm denetimler geçti');
process.exit(hata ? 1 : 0);
