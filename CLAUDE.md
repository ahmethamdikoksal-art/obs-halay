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
