# Proje Kuralları (obs-halay)

TikTok canlı yayını için yorumla oynanan "Online Halay" oyunu.

1. Önce plan modunda kısa bir plan yaz. Kullanıcı onaylayana kadar dosya yazma, kurulum yapma.
2. Kullanıcıya bağlı her kararı AskUserQuestion aracıyla sor; önerdiğin seçeneği ilk sıraya koy.
3. Bu kurallar CLAUDE.md dosyasında durur.
4. API anahtarını sohbete yazdırma. `.env.example` var; gerçek değeri kullanıcı `.env` dosyasına yazar. `.env` dosyası `.gitignore` içindedir.
5. Sunucular yalnız `127.0.0.1` adresine bağlansın.
6. TikTok şifresi ya da çerezi isteme. Yalnız okuma yap, yayına yazma.
7. Her adımdan sonra çalıştır, çıktıyı göster, hata varsa kök nedeni bul. "Çalışmalı" deme, kanıtla.

## İzinli komutlar
- hareket: `halay`, `horon`, `zeybek`, `yok`
- tempo: `yavas`, `orta`, `hizli`, `cosku`, `ayni`

## İstisna: telefon sürümü (telefon.html / telefon.mjs)
Kullanıcının kararıyla (yalnız iPhone'u var, YouTube'da yayın yapacak) köprüsüz bir tarayıcı sürümü vardır. Bu sürümde iki kural esner:
- **Kural 4:** API anahtarları `.env` yerine kullanıcının kendi telefonunun tarayıcısında (`localStorage`) durur. Kullanıcı anahtarı sayfadaki forma kendisi yazar. Anahtarlar koda, depoya ya da sohbete hiç girmez; yalnız Google'a, adres yerine `x-goog-api-key` başlığında gider. "Anahtarları sil" düğmesi depoyu boşaltır.
- **Kural 5:** sayfa 127.0.0.1 yerine GitHub Pages'ten (`https://ahmethamdikoksal-art.github.io/obs-halay/`) açılır. Bu statik bir sayfadır, sunucu açmaz; yerel köprüye bağlanmaz.
- Önerilen önlem: Google Cloud'da her iki anahtara **HTTP yönlendiren kısıtı** (`https://ahmethamdikoksal-art.github.io/*`) ve **API kısıtı** konur.
Bilgisayar sürümü (index.html + köprüler) için 7 kural aynen geçerlidir.
