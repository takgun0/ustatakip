# UstaTakip

**Esnaf için kargo takibi mantığında iş takip sistemi.**

Tamirciye arabasını, terziye kumaşını ya da mobilyacıya siparişini bırakan müşteri, işinin hangi aşamada olduğunu bir kargoyu izler gibi telefonundan takip eder. Esnaf da aynı soruya gün içinde defalarca telefonla cevap vermek zorunda kalmaz.

🔗 Canlı sürüm: https://takgun0.github.io/ustatakip/

> Bu depo bir proje ödevi olarak geliştirildi. Hazır bir ürün ya da başkalarının kurup kullanması için hazırlanmış bir paket değildir; amacı fikri, tasarımı ve teknik çözümleri göstermektir. Uygulamadaki işletme, müşteri, plaka ve telefon bilgileri tamamen uydurma demo verilerdir.

---

## Hangi sorunu çözüyor?

Küçük esnafta bir işin durumu genellikle yalnızca ustanın kafasındadır:

- Müşteri "Arabam ne durumda?" diye tekrar tekrar arar; usta işini bırakıp telefona bakar.
- Ek masraf (ör. "rot başı da değişmeli") telefonda konuşulur. Hangi fiyatta anlaşıldığının kaydı yoktur, sonradan anlaşmazlık çıkar.
- Esnaf, işlerin en çok nerede beklediğini (parça mı, onay mı, boya mı) ölçemez.

UstaTakip bu üç noktayı tek bir akışta toplar: **şeffaf süreç takibi**, **kayıtlı ek masraf pazarlığı** ve **darboğazı gösteren analiz**.

## Nasıl çalışır?

1. **İş kaydı:** Esnaf müşteriyi ve işi kaydeder. Sistem müşteriye özel bir takip kodu (`UT-7K4M-29`), bir bağlantı ve bir QR kod üretir. Esnaf bunları tek dokunuşla WhatsApp'tan gönderir.
2. **Takip:** Müşteri bağlantıyı açar ya da kodu ve telefonunun son 4 hanesini girer. Giriş yapmadan, uygulama indirmeden işinin aşamalarını görür.
3. **Aşamalar:** Esnaf işi "Teslim Alındı → Arıza Tespiti → Parça Bekleniyor → …" gibi kendi tanımladığı aşamalardan geçirir, müşterinin göreceği notlar ve fotoğraflar ekler. Müşterinin sayfası **anında, yenilemeden** güncellenir.
4. **Ek masraf ve pazarlık:** Esnaf ek iş için teklif gönderir. Müşteri onaylar, reddeder ya da karşı teklif verir; en fazla 3 tur pazarlık yapılır. Her adım kalıcı olarak kaydedilir ve onaylanan tutar işin toplamına eklenir.
5. **Teslim:** İş bitince esnaf teslimi işaretler ve müşteriye WhatsApp'tan hazır mesajla haber verir.
6. **Analiz:** Esnaf hangi aşamada ne kadar zaman kaybettiğini, ortalama teslim süresini ve tekliflerin kabul oranını görür.

## Ekranlar

| Kod | Ekran | Kim kullanır |
|---|---|---|
| M1 | Takip kodu ile sorgulama / QR okutma | Müşteri |
| M2 | Canlı iş takibi: aşamalar, notlar, fotoğraflar, geçmiş | Müşteri |
| M3 | Ek masraf teklifi: onay, ret, karşı teklif | Müşteri |
| E1 | Esnaf girişi ve kayıt | Esnaf |
| E2 | Aktif işler listesi | Esnaf |
| E3 | Yeni iş kaydı (kod, link ve QR üretimi) | Esnaf |
| E4 | İş detayı: aşama ilerletme, not, fotoğraf, teklif paneli | Esnaf |
| E5 | Süreç şablonları: aşama ekleme, sürükle-bırak sıralama, renk | Esnaf |
| E6 | Analiz: darboğaz aşaması, teslim süresi, teklif oranları | Esnaf |
| E7 | İşletme ayarları, logo, KVKK metni, WhatsApp mesaj şablonları | Esnaf |

Müşteri ekranları mobil öncelikli, esnaf paneli masaüstü ve mobil için tasarlandı. Tüm arayüz Türkçedir; para birimi `1.250,00 ₺` biçimindedir.

## Teknik yaklaşım

### Sunucusuz mimari
Uygulama **GitHub Pages** üzerinde statik olarak yayınlanıyor; yani kendi sunucusu yok. Sunucu tarafında yapılması gereken her şey **Supabase** üzerinde çalışıyor:

| Katman | Teknoloji |
|---|---|
| Arayüz | Next.js (App Router, statik dışa aktarım), TypeScript, Tailwind CSS |
| Veritabanı | PostgreSQL (Supabase), satır düzeyinde güvenlik (RLS) |
| Kimlik doğrulama | Supabase Auth (e-posta + şifre) |
| Sunucu mantığı | Supabase Edge Functions (Deno) ve veritabanı fonksiyonları |
| Dosyalar | Supabase Storage (fotoğraflar özel kovada) |
| Canlı güncelleme | Supabase Realtime |
| Doğrulama | Zod (tüm girdiler) |
| Test | Vitest |

### Güvenlik ve gizlilik
Müşteri giriş yapmadığı için güvenlik, tahmin edilemeyen bağlantılara ve sunucu tarafı denetimlere dayanıyor:

- **Takip bağlantısı:** 256 bit rastgele bir anahtar içerir ve adresin `#` kısmında durur. Bu kısım tarayıcıdan sunucuya hiç gönderilmez, bu yüzden erişim kayıtlarına düşmez. Bağlantı teslimden 30 gün sonra kendiliğinden geçersizleşir.
- **Takip kodu:** Okunması kolay bir alfabeyle üretilir (karışan I, L, O, U harfleri yok). Kodla sorgulamada telefonun son 4 hanesi de istenir; deneme sayısı IP ve kod başına sınırlıdır.
- **Satır düzeyinde güvenlik:** Her esnaf yalnızca kendi işletmesinin verisini görebilir. Müşteri tarafı hiçbir tabloya doğrudan erişemez, her şey doğrulama yapan sunucu fonksiyonlarından geçer.
- **IP adresleri saklanmaz:** Kötüye kullanım sınırları için IP'nin yalnızca anahtarlı özeti (HMAC) tutulur.
- **Fotoğraflar:** Dosya türü içeriğinden kontrol edilir (yalnızca JPEG/PNG/WebP, en fazla 5 MB). Konum dahil tüm EXIF/meta verisi sunucuda silinir. Fotoğraflar özel bir kovada durur ve yalnızca süreli imzalı bağlantılarla gösterilir.
- **Pazarlık kaydı değiştirilemez:** Teklif turları yalnızca eklenebilir; veritabanı tetikleyicisi güncellemeyi ve silmeyi engeller. Aynı anda gelen iki yanıta karşı iyimser kilitleme kullanılır.
- **Canlı güncellemede veri taşınmaz:** Realtime kanalı yalnızca "değişti" sinyali gönderir. Sayfa veriyi yine doğrulamalı uçtan çeker; kanal adı bağlantı anahtarının özetidir ve geriye çözülemez.

### Pazarlık kuralları
Teklif akışı, test edilmiş saf bir **durum makinesi** olarak yazıldı. Aynı kod hem arayüzde hem sunucu fonksiyonlarında çalışır:

```
esnaf fiyat ─► bekliyor ─(müşteri onay)──────► kabul   (tutar işe eklenir)
                 │      ─(müşteri ret)───────► ret
                 │      ─(karşı teklif, tur<3)─► karşı teklif ─(esnaf kabul)──► kabul
                 │                                            ─(esnaf ret)────► ret
                 │                                            ─(yeni fiyat)───► bekliyor, tur+1
3. turda müşteri yalnızca onaylar ya da reddeder. İş kapanırsa açık teklif düşer.
```

### Analiz: "kaybedilen süre"
Analiz ekranı her aşamanın tipik (medyan) süresini hesaplar ve bu süreyi aşan beklemeleri toplar. Böylece her zaman uzun süren ama öngörülebilir aşamalar (ör. boya kuruması) değil, **beklenmedik biçimde uzayan** aşamalar darboğaz olarak öne çıkar. Hesaplar veritabanı görünümlerinde yapılır ve RLS'e tabidir.

### Bildirimler
Mesajlar (iş kaydı, aşama değişti, teklif, karşı teklif, iş hazır, teslim edildi) Türkçe şablonlardan üretilir ve `wa.me` bağlantısı olarak hazırlanır. Esnaf mesajı kendi WhatsApp'ından tek dokunuşla gönderir. Esnafa giden karşı teklif bildirimi dışındaki şablonları esnaf ayarlar ekranından kendi üslubuyla yeniden yazabilir. `{müşteri}`, `{iş}`, `{link}` gibi alanları imlecin olduğu yere ekler ve sonucu örnek bilgilerle anında önizler. Yalnızca varsayılandan farklı olan metinler saklanır. Veritabanı yalnızca bilinen mesaj türlerini ve sınırlı uzunlukta metni kabul eder. WhatsApp Business API ve SMS için aynı arayüzü uygulayan taslaklar var, ama bunlar etkin değil.

### Performans ve erişilebilirlik
- Müşteri takip sayfası mobil Lighthouse ölçümünde **performans 93–94, erişilebilirlik 100, en iyi uygulamalar 100** aldı.
- Takip verisi, JavaScript paketi inmeden HTML'e gömülü küçük bir betikle istenir.
- Canlı güncelleme istemcisi ilk boyamadan sonra yüklenir.
- Renk kontrastları WCAG AA'ya göre seçildi; dokunma alanları en az 44 px. Sürükle-bırak klavyeyle de kullanılabilir ve ekran okuyucuya Türkçe duyurular yapar.

## Tasarım

Arayüz, önceden hazırlanmış bir tasarım sisteminden (`design/` klasörü) yola çıktı; ekran düzenleri ve bileşen kuralları oradan gelir. Renkler, köşe yarıçapları ve gölgeler `--ut-*` adlı tasarım tokenlarıyla tanımlı; bileşenler (`Button`, `StageProgress`, `JobCard`, `StatusBadge` …) bu tokenları kullanır. Bu sayede tema sonradan tek dosyadan modernleştirildi:
- indigo ana renk (`#4F46E5`) ve arduvaz tonlu zemin
- Plus Jakarta Sans yazı tipi
- 16 px köşeli kartlar ve yumuşak katmanlı gölgeler
- buzlu cam görünümlü yapışkan üst bar

Aşama durumları için amber/yeşil anlamı korundu. Tüm renk çiftleri WCAG AA kontrastını sağlar.

## Proje yapısı

```
src/
  app/                 Sayfalar (müşteri: takip, t; esnaf: giris, panel)
  components/ui/       Tasarım sistemi bileşenleri
  components/customer/ Müşteri ekranı parçaları
  components/panel/    Esnaf paneli parçaları (aşama editörü, teklif paneli, fotoğraflar)
  lib/                 Saf iş mantığı: takip kodu, teklif durum makinesi, para biçimi,
                       doğrulama şemaları, EXIF temizleme, analiz, bildirim şablonları
supabase/
  migrations/          Şema, RLS politikaları, tetikleyiciler, analiz görünümleri
  functions/           Edge Functions (iş kaydı, takip, teklif, fotoğraf yükleme)
design/                Tasarım kaynağı (ekran taslakları ve tokenlar)
```

`src/lib` altındaki saf modüller hem tarayıcıda hem de sunucu fonksiyonlarında aynı kaynaktan çalışır. Kopyaların güncel olup olmadığı testlerle denetlenir.

## Testler

İş kuralları birim testleriyle güvence altında:
- takip kodu ve anahtar üretimi
- telefon ve para biçimleri
- teklif durum makinesi
- EXIF temizleme
- analiz hesapları
- bildirim şablonları
- müşteri görünümünün kurulması

Her gönderimde GitHub Actions testleri, tür denetimini, lint'i ve derlemeyi çalıştırır.
