// Köprü, beyin ve sahte test arasında paylaşılan saf mantık.
// (index.html aynı kuralları kendi içinde taşır; ikisi test/ortak.test.mjs ile karşılaştırılır.)

export const HAREKETLER = ['halay', 'horon', 'zeybek', 'yok'];
export const TEMPOLAR = ['yavas', 'orta', 'hizli', 'cosku', 'ayni'];
export const KOMUT_ARALIGI_MS = 3000;
export const AZAMI_AVATAR = 60;

// Türkçe harfleri sadeleştirip küçült: "HIZLI Çoşku" -> "hizli cosku"
export function sadelestir(metin) {
  return String(metin ?? '')
    .toLocaleLowerCase('tr')
    .replace(/ı/g, 'i').replace(/ş/g, 's').replace(/ç/g, 'c')
    .replace(/ğ/g, 'g').replace(/ö/g, 'o').replace(/ü/g, 'u')
    .replace(/[âà]/g, 'a').replace(/[îì]/g, 'i').replace(/[ûù]/g, 'u')
    .normalize('NFKD').replace(/[̀-ͯ]/g, '');
}

// Kurala uyan yorumu doğrudan komuta çevir. Uymazsa null (yapay zekâya gider).
export function kuralKomutu(metin) {
  const s = sadelestir(metin);
  let hareket = null;
  let tempo = null;
  if (/\bha+la+y+\b/.test(s)) hareket = 'halay';
  else if (/\bho+ro+n+\b/.test(s)) hareket = 'horon';
  else if (/\bze+y+be+k+\b/.test(s)) hareket = 'zeybek';
  if (/\bcosku\w*/.test(s)) tempo = 'cosku';
  else if (/\bhizl[ia]\w*/.test(s)) tempo = 'hizli';
  else if (/\byavas\w*/.test(s)) tempo = 'yavas';
  else if (/^\s*orta\s*[.!]*\s*$/.test(s)) tempo = 'orta';
  if (!hareket && !tempo) return null;
  return { hareket: hareket ?? 'yok', tempo: tempo ?? 'ayni' };
}

// Listede olmayan değeri at.
export function hareketSuz(v) { return HAREKETLER.includes(v) ? v : 'yok'; }
export function tempoSuz(v) { return TEMPOLAR.includes(v) ? v : 'ayni'; }

// Aynı kişi KOMUT_ARALIGI_MS içinde yalnız bir komut verebilir.
export class HizSiniri {
  constructor(aralikMs = KOMUT_ARALIGI_MS, saat = () => Date.now()) {
    this.aralik = aralikMs;
    this.saat = saat;
    this.son = new Map();
  }
  izinVer(ad) {
    const simdi = this.saat();
    const once = this.son.get(ad);
    if (once !== undefined && simdi - once < this.aralik) return false;
    this.son.set(ad, simdi);
    if (this.son.size > 5000) { // bellek temizliği
      for (const [k, t] of this.son) if (simdi - t >= this.aralik) this.son.delete(k);
    }
    return true;
  }
}

export function kisiAdi(user) {
  return String(user?.nickname || user?.uniqueId || 'izleyici').slice(0, 24);
}

// tiktok-live-connector hediye verisini oyun olayına çevirir.
// Seri hediyede (giftType 1) repeatEnd gelmeden SAYMAZ: null döner.
export function hediyeOlayi(data) {
  const giftType = data?.giftDetails?.giftType;
  if (giftType === 1 && !data.repeatEnd) return null;
  return {
    tur: 'hediye',
    ad: kisiAdi(data.user),
    adet: Math.max(1, Number(data.repeatCount) || 1),
    metin: String(data?.giftDetails?.giftName || 'hediye').slice(0, 30),
  };
}

export function begeniOlayi(data) {
  return { tur: 'begeni', ad: kisiAdi(data?.user), adet: Math.max(1, Number(data?.likeCount) || 1) };
}

// Yorumu oyun olayına çevirir. Kurala uyarsa doğrudan, uymazsa yapay zekâya sorar.
// Hız sınırına takılan ya da komut çıkmayan yorum için null döner.
export async function yorumuCevir(ad, metin, sinir, yorumla) {
  ad = String(ad || 'izleyici').slice(0, 24);
  metin = String(metin || '').slice(0, 200);
  if (!metin.trim()) return null;
  const kural = kuralKomutu(metin);
  if (kural) {
    if (!sinir.izinVer(ad)) return null;
    return { tur: 'yorum', ad, metin };
  }
  if (!sinir.izinVer(ad)) return null;
  const c = await yorumla(metin, ad);
  if (c.hareket === 'yok' && c.tempo === 'ayni' && !c.soz) return null;
  return { tur: 'yapay', ad, metin, hareket: c.hareket, tempo: c.tempo, soz: c.soz };
}
