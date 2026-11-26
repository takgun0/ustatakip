# UstaTakip

Esnaf için kargo takibi mantığında iş takip sistemi. Esnaf işi kaydeder; sistem müşteriye takip kodu, link ve QR kod üretir. Müşteri işin hangi aşamada olduğunu canlı izler, ek masraf tekliflerini onaylar, reddeder ya da pazarlık eder.

> Proje 6 fazda geliştirildi (şema ve kimlik → iş kaydı → müşteri takibi → aşamalar ve fotoğraflar → ek masraf pazarlığı → analiz ve yayın).

## Mimari

| Katman | Teknoloji | Not |
|---|---|---|
| Arayüz | Next.js 16 (App Router, `output: "export"`), TypeScript, Tailwind v4 | GitHub Pages'te statik yayın |
| Veritabanı | Supabase Postgres + RLS | Esnaf yalnızca kendi `business_id` verisini görür, anon hiçbir tabloya erişemez |
| Kimlik | Supabase Auth (e-posta + şifre) | Kayıtta `handle_new_user` tetikleyicisi işletmeyi ve sektör şablonunu oluşturur |
| Sunucu işleri | Supabase Edge Functions | Müşteri işlemleri, kod/token üretimi, teklif durum makinesi, fotoğraf temizliği |
| Dosyalar | Supabase Storage | `job-media` private (signed URL), `logos` public |
| Canlı güncelleme | Supabase Realtime broadcast | Kanal adı token'ın SHA-256 özeti; kanaldan veri geçmez |

GitHub Pages sunucu kodu çalıştıramadığı için müşteri linkleri `/t/#<token>` biçimindedir: `#` sonrası sunucuya gönderilmez, token log'lara düşmez.

## Tasarım sistemi

- Kaynak: tasarım tuvali, kopyası `design/` klasöründe (`Main`, `M2`, `M3`, `E2`, `E4`).
- Tokenlar `src/app/globals.css` içinde `--ut-*` adlarıyla birebir tanımlı ve Tailwind temasına eşli (`bg-ut-primary`, `rounded-ut`, `shadow-ut` …).
- Tasarıma tek ek: `--ut-whatsapp` (`#15803D`). WhatsApp düğmelerinin koyu yeşil dolgusu; `--ut-success` beyaz metinle 3,3:1 kaldığı için daha koyu ton seçildi (5,0:1, WCAG AA). `Button` bileşeninde `whatsapp` varyantı.
- Bileşenler `src/components/ui`: `Button`, `StatusBadge`, `StageProgress`, `JobCard`, `Card`, `Field`, `States` (boş / yükleniyor / hata), `AppHeader` …
- Para biçimi `1.250,00 ₺` (`src/lib/money.ts`), tutarlar veritabanında kuruş cinsinden tam sayı.

## Kurulum

Gereksinimler: Node.js 20+, bir Supabase projesi.

```bash
npm install
cp .env.example .env.local   # değerleri doldurun
npm run dev                  # http://localhost:3000
```

### Supabase

1. Supabase'de yeni proje açın (Frankfurt / `eu-central-1` önerilir).
2. Migration'ları sırayla çalıştırın (SQL Editor'e yapıştırarak ya da Supabase CLI ile):
   ```bash
   npx supabase link --project-ref <proje-ref>
   npx supabase db push
   ```
   - `supabase/migrations/20261126120000_init_schema.sql` — tablolar, RLS, tetikleyiciler, storage bucket'ları
   - `supabase/migrations/20261126120100_harden_function_grants.sql` — fonksiyon yetkileri
   - `…150000_ip_hash_secret.sql` — IP özetleri için Vault anahtarı
   - `…170000_stage_and_template_rpcs.sql`, `…170100_events_note_update_policy.sql` — aşama ve şablon işlemleri
   - `…180000_offer_functions.sql` — teklif yazma fonksiyonları (yalnızca service_role)
   - `…200000_analytics_views.sql` — E6 analiz görünümleri (`security_invoker`)
   - Edge Function'ları dağıtın: `npx supabase functions deploy <ad>` (müşteri uçları `track-lookup`, `track-get`, `track-rate`, `offer-action` için `--no-verify-jwt`)
3. Hazır şablonları yükleyin: `supabase/seed.sql` (Oto Tamir, Oto Yıkama, Mobilya, Terzi). Tekrar çalıştırılabilir.
4. **Authentication → URL Configuration**: *Site URL* ve *Redirect URLs* alanlarına `http://localhost:3000` ve yayın adresinizi (`https://<kullanıcı>.github.io/ustatakip`) ekleyin.
5. **Authentication → Providers → Email**: Supabase'in varsayılan e-posta servisi yalnızca proje ekibine posta gönderir. Gerçek kullanıcılar için ya özel SMTP tanımlayın ya da demo için *Confirm email* seçeneğini kapatın.

### Ortam değişkenleri

| Değişken | Nerede | Açıklama |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `.env.local`, GitHub Actions | Proje adresi |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `.env.local`, GitHub Actions | Herkese açık anahtar (`sb_publishable_…`) |
| `NEXT_PUBLIC_BASE_PATH` | GitHub Actions | Repo adı, ör. `/ustatakip` |
| `NEXT_PUBLIC_SITE_URL` | GitHub Actions | Paylaşım linkleri için tam adres |
| `IP_HASH_SECRET` | Supabase Edge Function secret (isteğe bağlı) | IP özetleri için HMAC anahtarı. Tanımlı değilse Supabase Vault'taki `ip_hash_secret` kullanılır (migration ilk çalıştığında rastgele üretir) |

`service_role` anahtarı ve `IP_HASH_SECRET` **hiçbir zaman** repoya ya da frontend'e girmez.

## Komutlar

```bash
npm run dev        # geliştirme sunucusu
npm run build      # statik çıktı → out/
npm test           # birim testleri (Vitest)
npm run lint
npm run typecheck
npm run sync:functions   # src/lib ortak modüllerini supabase/functions/_shared içine kopyalar
npm run check:functions  # kopyalar güncel mi (testler de denetler)
```

## Edge Function'lar

| Fonksiyon | Çağıran | Görev |
|---|---|---|
| `job-create` | Esnaf (oturum zorunlu) | İşi doğrular, `UT-` takip kodu ve 256 bit token üretir, ilk aşama kaydını açar |
| `track-lookup` | Müşteri (M1) | Kod + telefonun son 4 hanesini doğrular, takip token'ını döner. IP başına 15 dakikada 10, kod başına saatte 6 deneme |
| `track-get` | Müşteri (M2/M3/M4) | Token'la takip verisini döner; fotoğraflar 1 saatlik imzalı URL. IP başına 10 dakikada 120 istek |
| `track-rate` | Müşteri (M4) | Teslim edilen iş için tek seferlik 1–5 puan |
| `offer-action` | Müşteri (M3) | Ek masraf teklifine yanıt: kabul, ret ya da karşı teklif (isteğe bağlı notla). Token doğrulanır, IP başına 10 dakikada 20 istek; IP yalnızca HMAC özeti olarak tura yazılır |
| `offer-manage` | Esnaf (oturum zorunlu) | `op: "create"` yeni teklif (iş başına aynı anda tek açık teklif), `op: "respond"` karşı teklife kabul / ret / yeni fiyat |
| `media-upload` | Esnaf (oturum zorunlu) | Aşama fotoğrafı: tür sihirli baytlardan (JPEG/PNG/WebP), en fazla 5 MB, EXIF/XMP/metin sunucuda atılır, özel `job-media` kovasına yazılır. İşletme başına 10 dakikada 60 yükleme, iş başına en fazla 40 fotoğraf |

Müşteri uçları oturum istemez (`verify_jwt: false`); her istek token ya da kod + son 4 hane ile doğrulanır. IP adresleri saklanmaz, yalnızca HMAC özetleri rate limit anahtarı olarak kullanılır.

## Müşteri sayfaları ve canlı güncelleme

- **M1 `/takip/`**: takip kodu + son 4 hane ya da "QR Okut" (tarayıcı destekliyorsa kamerayla; desteklemiyorsa telefonun kamera uygulaması QR'daki linki doğrudan açar).
- **M2 `/t/#<token>`**: token adresin `#` kısmında durur, bu yüzden sunucuya ve GitHub Pages loglarına gitmez.
- **M3 `/t/teklif/#<token>/<teklifId>`**: ek masraf teklifi; "Onayla", "Reddet" (onaylı) ya da "Pazarlık Yap" ile karşı teklif. Tur geçmişi, kalan tur ve sonuç kutuları gösterilir; karşı tekliften sonra ustaya WhatsApp mesajı hazır gelir.
- **M4 `/t/teslim/#<token>`**: teslim özeti ve 1–5 puan.

Aşama, fotoğraf ya da teklif değişince veritabanı tetikleyicisi `job:<sha256(token)>` kanalına içeriksiz bir Realtime yayını gönderir; sayfa bu sinyalle veriyi `track-get` üzerinden yeniden çeker. Kanal adından token çıkarılamaz, kanalda veri taşınmaz.

### Performans (M2, Lighthouse mobil)

Ölçüm (2026-11-26, Lighthouse 12, mobil, gzip'li statik sunucu — GitHub Pages gibi): **Performans 93–94, Erişilebilirlik 100, En iyi uygulamalar 100**. LCP 3,1 sn, TBT 20 ms, CLS 0.

- Takip verisi, HTML'e gömülü küçük bir betikle (`src/app/t/layout.tsx`) JS paketi inmeden istenir; React yüklenince bu sonucu kullanır.
- Müşteri uçları "basit" CORS isteğiyle çağrılır (`text/plain` gövde, özel başlık yok), böylece OPTIONS ön isteği olmaz.
- Realtime istemcisi ilk boyamadan sonra tembel yüklenir; müşteri sayfalarında supabase-js ve zod yoktur.
- SEO puanı (60) bilinçli: takip sayfaları kişisel veri içerdiği için `noindex` ile arama motorlarına kapalıdır; diğer SEO denetimleri geçer.

Tekrar ölçmek için: `npm run build`, `node .tmp-dev/static-gzip.mjs out 4174`, ardından `npx lighthouse http://127.0.0.1:4174/t/#<token> --form-factor=mobile`. Sıkıştırmasız bir sunucuyla (ör. `python -m http.server`) ölçüm ~76 çıkar; GitHub Pages gzip kullandığı için gerçekçi değildir.

Ortak kod (`tracking`, `phone`, `validation`, `money`, `notifications`, `customer-view`, `exif`) tek kaynaktan, `src/lib` altından gelir; `_shared` kopyalarını elle düzenlemeyin.

## Esnaf ekranları: aşama ve süreçler

- **E4 `/panel/is/?id=…`**: aktif aşama kartında müşterinin göreceği not, fotoğraflar (tarayıcıda 1600 px'e küçültülüp meta verisiz yeniden kodlanır, sunucuda ayrıca temizlenir) ve tek dokunuşla "Sonraki aşamaya geç". Son aşamada düğme "İşi tamamla ve teslim et" olur. İlerletmeden sonra müşteriye WhatsApp mesajı hazır gelir. "Son ilerletmeyi geri al" son adımı (teslim dahil) geri alır.
- **E5 `/panel/surecler/`**: şablon adı, 2–12 aşama, sürükle-bırak sıralama (fare, dokunma, klavye: Boşluk + oklar), `--ut-*` paletinden renk. İş kaydında geçen aşama silinemez, adı ve sırası değişebilir. Hazır sektör şablonları kopyalanarak eklenir.

- **E4 teklif paneli** (sağ sütun): "Teklif Oluştur" (başlık, açıklama, tutar), müşteriden karşı teklif gelince "Kabul Et / Reddet / Yeni Fiyat Ver" kartı, tüm tekliflerin tur geçmişi. Teklif ya da yeni fiyat gönderilince müşteriye WhatsApp mesajı hazır gelir.

## Ek masraf teklifleri ve pazarlık

Bir **tur** = ustanın fiyatı + müşterinin yanıtı; en fazla **3 tur**. Kurallar `src/lib/offers.ts` durum makinesindedir (testli) ve Edge Function'lar aynı kodu kullanır:

```
esnaf fiyat ─► pending ─(müşteri onay)─► accepted   (tutar iş toplamına eklenir)
                 │  ─(müşteri ret)────► rejected
                 │  ─(karşı teklif, tur < 3)─► countered ─(esnaf kabul)─► accepted
                 │                                       ─(esnaf ret)──► rejected
                 │                                       ─(yeni fiyat)─► pending, tur + 1
3. turda müşteri yalnızca onaylar ya da reddeder. İş kapanırsa açık teklif "expired" olur.
```

Yazma, yalnızca `service_role`'ün çağırabildiği `open_offer_tx` ve `apply_offer_round` fonksiyonlarıyla tek işlemde yapılır; okunan durum/tur arada değiştiyse istek reddedilir (yarış koşulu koruması). `offer_rounds` yalnızca eklenebilir (tetikleyici güncelleme/silmeyi engeller). Tutarlar kuruş (tam sayı) olarak saklanır, ekranda `1.250,00 ₺` biçiminde gösterilir.

Çok adımlı yazmalar veritabanında `SECURITY INVOKER` fonksiyonlarla tek işlemde yapılır (`advance_job`, `undo_job_stage`, `set_stage_note`, `save_template`, `create_template`); RLS çağıran esnafın kimliğiyle geçerlidir.

## Analiz (E6)

`/panel/analiz/` sayfası üç veritabanı görünümünü okur. Görünümler `security_invoker = true` ile tanımlıdır: sorgu çağıran esnafın yetkisiyle çalışır, alttaki tabloların RLS'i geçerlidir ve anon erişimi yoktur.

| Görünüm | İçerik |
|---|---|
| `analytics_stage_durations` | Her aşama kaydının giriş/çıkış zamanı ve süresi (çıkış = sonraki aşama, teslim ya da iptal; aktif işin son aşaması "açık") |
| `analytics_stage_stats` | Şablon aşaması başına geçiş sayısı, ortalama / medyan / en uzun süre, şu an bekleyen iş, kaybedilen süre |
| `analytics_business_summary` | Aktif / teslim edilen iş, ortalama teslim süresi, ortalama puan, teklif kabul oranı ve onaylanan ek masraf |

**Kaybedilen süre**: bir aşamadaki her geçişte, o aşamanın medyan süresini aşan kısmın toplamı. Hep uzun süren ama öngörülebilir aşamalar (ör. boya kuruması) kayıp sayılmaz; tipik süreyi aşan beklemeler darboğazı gösterir. Sayfada dönem (7/30/90 gün, tümü) ve süreç seçilebilir; hesaplar `src/lib/analytics.ts` içindedir (testli).

## Yayın (GitHub Pages)

`.github/workflows/pages.yml` her push ve pull request'te testleri, tür denetimini, lint'i ve statik derlemeyi çalıştırır. **Yayın yalnızca elle yapılır**: Actions → *Pages* → *Run workflow* (main dalında).

1. Settings → Pages → *Source*: **GitHub Actions**.
2. Settings → Secrets and variables → Actions → **Variables**: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. `NEXT_PUBLIC_BASE_PATH` ve `NEXT_PUBLIC_SITE_URL` repo adından otomatik üretilir.
3. Supabase → Authentication → URL Configuration'a yayın adresini ekleyin.

Statik dışa aktarımda dinamik segment yoktur: iş detayı `/panel/is/?id=…`, müşteri sayfaları `/t/#<token>`, `/t/teklif/#<token>/<teklifId>`, `/t/teslim/#<token>` biçimindedir.

## Bildirimler

`src/lib/notifications.ts` içindeki `NotificationService` beş olay için Türkçe mesaj üretir: iş oluşturuldu, aşama değişti, teklif gönderildi, karşı teklif geldi, iş hazır. MVP'de mesajlar `wa.me` linki olarak hazırlanır ve esnaf kendi WhatsApp'ından gönderir. WhatsApp Cloud API ve SMS sağlayıcıları aynı arayüzü uygulayan taslaklardır; kullanılamadıklarında servis otomatik olarak wa.me linkine düşer.
