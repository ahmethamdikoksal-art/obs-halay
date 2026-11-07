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
