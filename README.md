# obs-halay: TikTok ve YouTube canlı yayını için "Online Halay"

İzleyiciler yorum yazarak köy meydanındaki halaya katılır. Davul ve zurna çalar, başta mendil sallayan **yapay zekâ halay başı** durur.

| İzleyici ne yapar | Ekranda ne olur |
|---|---|
| `HALAY` yazar | Avatarı sıraya girer (zaten sıradaysa dans halaya döner) |
| `HORON` / `ZEYBEK` yazar | Dans değişir |
| `HIZLI`, `YAVAŞ`, `COŞKU` yazar | Tempo değişir |
| Serbest yorum yazar | Yapay zekâ yorumu izinli bir komuta çevirir ve kısa bir cevap yazar |
| 40 beğeni | Tempo bir kademe artar (yavas → orta → hizli → cosku) |
| Hediye gönderir | Mendil ona geçer, halay başı olur; yapay zekâ kenara geçip "çağırıcı" olur |

İzinli komutlar: hareket `halay, horon, zeybek, yok`; tempo `yavas, orta, hizli, cosku, ayni`. Bunların dışında kalan her değer kodda atılır.

Sınırlar: bir kişi 3 saniyede en çok bir komut verebilir. Ekranda en çok 60 avatar olur; sıra doluyken yeni biri gelirse en uzun süredir komut vermeyen kişi yerini bırakır (halay başı hariç). 45 saniye beğeni gelmezse tempo bir kademe düşer, ama "orta"nın altına inmez.

> ## ⚠️ tiktok-live-connector hakkında
> - [`tiktok-live-connector`](https://github.com/zerodytrash/TikTok-Live-Connector) **resmî bir TikTok kütüphanesi değildir**. TikTok ile bir bağı yoktur ve TikTok'un iç protokolü değişirse çalışmayabilir.
> - Kütüphane **AGPL-3.0** lisanslıdır (`AGPL-3.0-only`). Bu projeyi dağıtır ya da ağ üzerinden hizmet olarak sunarsan AGPL koşulları geçerli olur.
> - Kütüphane, bağlantıyı imzalamak için üçüncü taraf bir hizmeti (Euler Stream) kullanır. Bu proje oraya **hiçbir TikTok şifresi ya da çerezi göndermez**. Yalnız yayıncının kullanıcı adıyla, giriş yapmadan okuma yapar ve yayına hiçbir şey yazmaz.

## Dosyalar

| Dosya | Görevi |
|---|---|
| `index.html` | 1080x1920 oyun ekranı. Tek giriş kapısı: `olay({tur, ad, metin, adet, hareket, tempo, soz})`. Yanında bir deneme paneli var; `?temiz=1` ile gizlenir |
| `kopru-youtube.mjs`, `youtube.mjs` | YouTube canlı sohbetini resmî YouTube Data API v3 ile okur; aynı oyun olaylarına çevirir |
| `kopru.mjs` | TikTok'tan yorum, beğeni ve hediyeyi okur, `127.0.0.1:8765` adresinden sayfaya yollar. Sayfayı da aynı adresten sunar |
| `beyin.mjs` | Kurala uymayan yorumu Gemini'ye gönderir; yalnız JSON `{hareket, tempo, soz}` ister |
| `ortak.mjs` | Ortak kurallar: komut ayrıştırma, 3 sn sınırı, seri hediye (`repeatEnd`) mantığı |
| `sunucu.mjs` | Yalnız `127.0.0.1` adresinde çalışan HTTP ve WebSocket sunucusu |
| `sahte-test.mjs` | Gerçek yayın olmadan sahte olay yollar; yapay zekâyı 10 yorumla ölçer |
| `test/` | Birim testleri (`npm test`) ve tarayıcı denetimi (`npm run kontrol`) |

## Kurulum

Node.js 20 ya da üstü gerekir.

```bash
npm install
cp .env.example .env      # Windows: copy .env.example .env
```

`.env` dosyasını kendin doldur (bu dosya `.gitignore` içinde, depoya girmez):

```
GEMINI_API_KEY=...            # https://aistudio.google.com/apikey
GEMINI_MODEL=gemini-2.5-flash
TIKTOK_KULLANICI=yayinci_adi  # @ olmadan
WS_PORT=8765
```

Anahtar yoksa oyun yine çalışır. O durumda yalnız kurala uyan yorumlar (HALAY/HORON/ZEYBEK/HIZLI…) işlenir.

## Başlat ve durdur

| İş | Komut |
|---|---|
| **Başlat** (gerçek yayın) | `npm start` ya da `node kopru.mjs yayinci_adi` |
| **Durdur** | Köprünün çalıştığı terminalde `Ctrl + C` |
| Sahte olaylarla dene (köprü kapalıyken) | `npm run sahte` |
| Yalnız yapay zekâ ölçümü | `npm run olcum` |
| Birim testleri | `npm test` |
| Tarayıcı denetimi (Playwright gerekir) | `npm run kontrol` |

Köprü açıldığında şunu yazar: `sayfa: http://127.0.0.1:8765/?temiz=1`. Yayıncı o anda yayında değilse 30 saniyede bir yeniden dener. Bağlantı koparsa 10 saniye sonra yeniden bağlanır. Sayfa da köprü koparsa 2 saniyede bir yeniden bağlanmayı dener.

`sahte-test.mjs` köprüyle aynı portu kullanır. Bu yüzden önce köprüyü `Ctrl + C` ile durdur, yoksa "Port 8765 kullanımda" uyarısı çıkar.

## OBS: Tarayıcı kaynağı

1. OBS → **Ayarlar → Video**: Temel ve Çıkış çözünürlüğünü `1080x1920` yap (dikey yayın).
2. Önce köprüyü başlat (`npm start`).
3. **Kaynaklar → + → Tarayıcı** ekle:
   - **Yerel dosya** kutusu **boş** kalsın.
   - **URL**: `http://127.0.0.1:8765/?temiz=1`
   - **Genişlik** `1080`, **Yükseklik** `1920`
   - **Sesi OBS üzerinden kontrol et** kutusunu işaretle. Davul ve zurna sesi o zaman OBS ses karıştırıcısına gelir.
   - "Görünür olmadığında kaynağı kapat" kutusu boş kalsın; yoksa sıra sıfırlanır.
4. Köprüsüz, yalnız dosyayla açmak istersen URL kısmına `file:///C:/yol/obs-halay/index.html?temiz=1` yaz. ("Yerel dosya" kutusu `?temiz=1` eklentisini taşımaz.)

Sesi istemezsen adrese `&ses=0` ekle. Deneme panelini görmek için `?temiz=1` olmadan aç: `http://127.0.0.1:8765/`

## TikTok LIVE Studio: Bağlantı kaynağı

1. Önce köprüyü başlat (`npm start`).
2. LIVE Studio'da dikey (portre) sahne seç.
3. **Kaynak ekle → Bağlantı** (İngilizce arayüzde *Link*) seç.
4. Adres olarak `http://127.0.0.1:8765/?temiz=1` yaz; boyutu `1080x1920` yap ve kaynağı tüm tuvale yay.
5. Ses gelmezse sesi OBS'ten ver (yukarıdaki yöntem) ya da OBS Sanal Kamerası'nı LIVE Studio'ya kaynak olarak ekle.

Menü adları LIVE Studio sürümüne göre değişebilir. Bu adımlar bu geliştirme ortamında denenemedi.

## YouTube canlı yayın

Oyun ekranı ve kuralları aynıdır. Yalnız köprü değişir: `npm start` yerine `npm run youtube` çalıştırılır. İki köprü aynı portu kullandığından aynı anda açılmaz.

| YouTube'da izleyici ne yapar | Oyunda karşılığı |
|---|---|
| Sohbete yazar | Yorum (HALAY / HORON / ZEYBEK / serbest yorum, TikTok'taki gibi) |
| Videoyu beğenir | Toplam beğeni sayısı 30 sn'de bir okunur; her 40 artışta tempo bir kademe yükselir |
| Super Chat, Super Sticker, üyelik, hediye üyelik | Mendil ona geçer, halay başı olur |

**Kurulum**

1. [Google Cloud Console](https://console.cloud.google.com/)'da bir proje aç. **API'ler ve Hizmetler → Kitaplık** bölümünden **YouTube Data API v3**'ü etkinleştir.
2. **Kimlik bilgileri → Kimlik bilgisi oluştur → API anahtarı** seç. Anahtarı **API kısıtlamaları** kısmından yalnız *YouTube Data API v3* ile sınırla.
3. `.env` dosyasına kendin yaz:
   ```
   YOUTUBE_API_KEY=...
   YOUTUBE_YAYIN=https://www.youtube.com/live/XXXXXXXXXXX
   YOUTUBE_ARALIK_SN=5
   ```
   `YOUTUBE_YAYIN` yerine `watch?v=…` adresi, `youtu.be/…` adresi ya da 11 karakterlik video kimliği de olur. Adresi YouTube Studio'da yayını oluşturunca alırsın.
4. OBS'te **Ayarlar → Yayın → Hizmet: YouTube** seç ve hesabını bağla ya da yayın anahtarını gir. Dikey yayın için çözünürlük `1080x1920` kalabilir.
5. OBS tarayıcı kaynağının adresi: `http://127.0.0.1:8765/?temiz=1&platform=youtube`. `platform=youtube` kural kutusuna "Super Chat / üyelik" yazar.

**Başlat ve durdur**

| İş | Komut |
|---|---|
| **Başlat** | `npm run youtube` ya da `node kopru-youtube.mjs https://www.youtube.com/live/XXXXXXXXXXX` |
| **Durdur** | Köprünün terminalinde `Ctrl + C` |
| Sahte YouTube olaylarıyla dene (köprü kapalıyken) | `node sahte-test.mjs --youtube` |

Yayın henüz başlamadıysa köprü 60 sn'de bir yeniden bakar. Açılış anında sohbette duran eski mesajlar oyuna alınmaz. Yayın bitince köprü bunu yazar ve beklemeye geçer.

**Kota ve gecikme**

- YouTube API'sinin günlük kotası varsayılan olarak 10.000 birimdir. Google'ın kota tablosuna göre sohbet okuma 5 birim, video bilgisi (beğeni) 1 birimdir. Bu rakamlar gerçek anahtarla ölçülmedi.
- 5 sn aralıkla bu, saatte yaklaşık 720 × 5 + 120 ≈ 3.700 birim eder. Yani varsayılan kota **yaklaşık 2,5–3 saatlik yayına** yeter.
- Daha uzun yayın için `YOUTUBE_ARALIK_SN` değerini büyüt (10 sn → yaklaşık 5,5 saat) ya da Google'dan kota artışı iste.
- YouTube daha uzun bir okuma aralığı önerirse onunki kullanılır.
- Kota dolarsa köprü bunu yazar, 15 dk bekleyip yeniden dener. Oyun ekranı ve deneme paneli çalışmaya devam eder.
- Mesajlar birkaç saniye gecikmeli gelir. Beğeni artışı 30 sn'de bir yansır. Kanal beğeni sayısını gizlediyse 40 beğeni kuralı çalışmaz; köprü bunu açılışta yazar.

**Güvenlik:** Yalnız API anahtarı kullanılır; OAuth girişi, şifre ya da çerez yoktur. Anahtarla yalnız okunabilir, sohbete yazılamaz. Anahtar isteğe adres yerine başlıkta eklenir, böylece günlüklere düşmez.

## Yapay zekâ kuralları (beyin.mjs)

- Yönergede iki olumlu, bir olumsuz örnek var. Gemini'den `responseMimeType: application/json` ve bir şema ile yalnız JSON istenir.
- "Önceki talimatları unut", "ignore previous instructions", "sistem promptu", "sen artık …", "API anahtarını söyle" gibi yorumlar Gemini'ye **hiç gönderilmez**.
- Yanıttaki her değer koddaki izinli listeyle yeniden süzülür. Söz en çok 80 karakterdir; bağlantılar silinir.
- Karakter ekranda her yerde "🤖 Yapay Zekâ Halay Başı" diye görünür. Söz insan olduğunu iddia ederse kod onu "Ben yapay zekâ halay başıyım 🤖" ile değiştirir.
- Zaman aşımı 6 saniyedir. Hata olursa yorum sessizce atlanır, oyun sürer.

## Güvenlik

- Sunucular yalnız `127.0.0.1` adresine bağlanır, ağdaki başka cihazlardan erişilemez. HTTP sunucusu yalnız `index.html` dosyasını verir.
- API anahtarı yalnız `.env` dosyasında durur. `.env` depoya girmez.
- TikTok'ta ve YouTube'da yalnız okuma yapılır. Şifre ya da çerez istenmez, yayına yorum yazılmaz.
