import { test } from 'node:test';
import assert from 'node:assert/strict';
import { videoKimligi, mesajOlayi, BegeniSayaci, sohbetOku, videoBilgisi } from '../youtube.mjs';

const yanit = (durum, govde) => ({ ok: durum < 400, status: durum, json: async () => govde });
const hata = (durum, neden) => yanit(durum, { error: { code: durum, message: neden, errors: [{ reason: neden }] } });
const mesaj = (type, ek = {}, name = 'Ayşe') => ({ snippet: { type, ...ek }, authorDetails: { displayName: name } });

test('video kimliği ayrıştırma', () => {
  const id = 'jfKfPfyJRdk';
  for (const g of [id, `https://www.youtube.com/live/${id}?si=abc`, `https://youtube.com/watch?v=${id}&t=3`, `https://youtu.be/${id}`, `https://m.youtube.com/shorts/${id}`])
    assert.equal(videoKimligi(g), id, g);
  for (const g of ['', 'kisa', 'https://kotu.com/watch?v=jfKfPfyJRdk', 'https://youtube.com/@kanal']) assert.equal(videoKimligi(g), null, g);
});

test('mesaj türleri olaya dönüşür', () => {
  assert.deepEqual(mesajOlayi(mesaj('textMessageEvent', { textMessageDetails: { messageText: 'HALAY' } })), { tur: 'yorum', ad: 'Ayşe', metin: 'HALAY' });
  assert.deepEqual(mesajOlayi(mesaj('superChatEvent', { superChatDetails: { amountDisplayString: '₺50,00' } })), { tur: 'hediye', ad: 'Ayşe', adet: 1, metin: 'Super Chat ₺50,00' });
  assert.equal(mesajOlayi(mesaj('superStickerEvent', { superStickerDetails: { amountDisplayString: '$2' } })).metin, 'Super Sticker $2');
  assert.deepEqual(mesajOlayi(mesaj('newSponsorEvent')), { tur: 'hediye', ad: 'Ayşe', adet: 1, metin: 'üyelik' });
  assert.equal(mesajOlayi(mesaj('membershipGiftingEvent', { membershipGiftingDetails: { giftMembershipsCount: 5 } })).adet, 5);
  assert.equal(mesajOlayi(mesaj('giftMembershipReceivedEvent')), null);
  assert.equal(mesajOlayi(mesaj('messageDeletedEvent')), null);
  assert.equal(mesajOlayi(mesaj('textMessageEvent', { textMessageDetails: { messageText: 'x' } }, '@kanal_adi')).ad, 'kanal_adi');
});

test('beğeni artışı', () => {
  const b = new BegeniSayaci();
  assert.equal(b.guncelle(1000), null);              // ilk okuma taban
  assert.deepEqual(b.guncelle(1045), { tur: 'begeni', ad: 'YouTube', adet: 45 });
  assert.equal(b.guncelle(1045), null);              // değişmedi
  assert.equal(b.guncelle(1040), null);              // düştü: yeni taban
  assert.equal(b.guncelle(1050).adet, 10);
  assert.equal(b.guncelle(null), null);              // gizli sayı
  assert.equal(b.guncelle(1060).adet, 10);
});

test('videoBilgisi: canlı, bitmiş, yok', async () => {
  const canli = async () => yanit(200, { items: [{ snippet: { title: 'T' }, liveStreamingDetails: { activeLiveChatId: 'SOHBET' }, statistics: { likeCount: '12' } }] });
  assert.deepEqual(await videoBilgisi(canli, 'k', 'x'), { sohbetId: 'SOHBET', begeni: 12, baslik: 'T' });
  const bitmis = async () => yanit(200, { items: [{ liveStreamingDetails: { activeLiveChatId: 'S', actualEndTime: '2026' }, statistics: {} }] });
  assert.deepEqual(await videoBilgisi(bitmis, 'k', 'x'), { sohbetId: null, begeni: null, baslik: '' });
  await assert.rejects(videoBilgisi(async () => yanit(200, { items: [] }), 'k', 'x'), /bulunamadı/);
});

function sahteApi(sayfalar) {
  const istekler = [];
  const getir = async (url, secenek) => { istekler.push({ url: new URL(url), anahtar: secenek.headers['x-goog-api-key'] }); return sayfalar.shift() ?? hata(403, 'liveChatEnded'); };
  return { getir, istekler };
}

test('sohbetOku: eski mesajlar atlanır, pageToken zinciri, bekleme süresi', async () => {
  const { getir, istekler } = sahteApi([
    yanit(200, { nextPageToken: 'A', pollingIntervalMillis: 1000, items: [mesaj('textMessageEvent', { textMessageDetails: { messageText: 'ESKİ' } })] }),
    yanit(200, { nextPageToken: 'B', pollingIntervalMillis: 8000, items: [mesaj('textMessageEvent', { textMessageDetails: { messageText: 'HALAY' } }), mesaj('superChatEvent', { superChatDetails: { amountDisplayString: '₺5' } }, 'Veli')] }),
  ]);
  const olaylar = [], beklemeler = [];
  const sonuc = await sohbetOku({ anahtar: 'GIZLI', sohbetId: 'S1', getir, olayVer: (o) => olaylar.push(o), uyu: async (ms) => beklemeler.push(ms) });
  assert.equal(sonuc, 'bitti');
  assert.deepEqual(olaylar.map((o) => o.metin), ['HALAY', 'Super Chat ₺5']);
  assert.deepEqual(istekler.map((i) => i.url.searchParams.get('pageToken')), [null, 'A', 'B']);
  assert.ok(istekler.every((i) => i.anahtar === 'GIZLI' && !i.url.search.includes('GIZLI')), 'anahtar adreste yok');
  assert.deepEqual(beklemeler, [5000, 8000]); // 1000 -> en az 5000
});

test('sohbetOku: kota dolunca bekler, anahtar hatasında durur', async () => {
  const a = sahteApi([yanit(200, { items: [] }), hata(403, 'quotaExceeded'), yanit(200, { items: [mesaj('newSponsorEvent')] })]);
  const olaylar = [], beklemeler = [];
  assert.equal(await sohbetOku({ anahtar: 'k', sohbetId: 's', getir: a.getir, olayVer: (o) => olaylar.push(o), uyu: async (ms) => beklemeler.push(ms) }), 'bitti');
  assert.deepEqual(beklemeler, [5000, 15 * 60000, 5000]);
  assert.equal(olaylar.length, 1);
  const b = sahteApi([yanit(400, { error: { code: 400, message: 'API key not valid', details: [{ reason: 'API_KEY_INVALID' }] } })]);
  assert.equal(await sohbetOku({ anahtar: 'k', sohbetId: 's', getir: b.getir, olayVer: () => {}, uyu: async () => {} }), 'anahtar');
  const c = sahteApi([yanit(200, { items: [], offlineAt: '2026-11-11T10:00:00Z' })]);
  assert.equal(await sohbetOku({ anahtar: 'k', sohbetId: 's', getir: c.getir, olayVer: () => {}, uyu: async () => {} }), 'bitti');
});

test('sohbetOku: durdurma sinyali', async () => {
  const ac = new AbortController();
  const a = sahteApi([yanit(200, { items: [] }), yanit(200, { items: [] })]);
  const s = await sohbetOku({ anahtar: 'k', sohbetId: 's', getir: a.getir, olayVer: () => {}, sinyal: ac.signal, uyu: async () => ac.abort() });
  assert.equal(s, 'durduruldu');
});
