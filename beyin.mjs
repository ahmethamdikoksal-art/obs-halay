// Köprüler için yapay zekâ: .env değerlerini okuyup beyin-cekirdek.mjs'i çağırır.
// (Tarayıcı sürümü telefon.html çekirdeği doğrudan kullanır.)
import 'dotenv/config';
import { yorumla as cekirdekYorumla } from './beyin-cekirdek.mjs';

export { BOS, YONERGE, VARSAYILAN_MODEL, enjeksiyonMu, sozSuz, dogrula } from './beyin-cekirdek.mjs';

// Dönüş: {hareket, tempo, soz, kaynak, hata?}
export function yorumla(metin, ad = 'izleyici', secenek = {}) {
  return cekirdekYorumla(metin, ad, {
    ...secenek,
    anahtar: secenek.anahtar ?? process.env.GEMINI_API_KEY,
    model: secenek.model ?? process.env.GEMINI_MODEL,
  });
}
