import Link from "next/link";
import { BASE_PATH } from "@/lib/site";
import { cn } from "@/lib/cn";
import { BrandMark } from "@/components/ui/BrandMark";
import { ButtonLink } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import {
  IconArrowRight,
  IconCheck,
  IconChevronDown,
  IconLogIn,
  IconMapPin,
} from "@/components/ui/icons";

/*
 * L1 · Tanıtım / ilk giriş (design/L1.dc.html). Statik sayfa; hero'daki takip kodu
 * JavaScript gerekmeden /takip/?kod=… adresine gider ve orada kod alanını doldurur.
 */

const STEPS = [
  {
    title: "İş kaydı açılır",
    body: "Esnaf aracı, mobilyayı ya da cihazı teslim alırken işi birkaç dokunuşla kaydeder ve kendi aşamalarını seçer.",
    who: "Esnaf",
  },
  {
    title: "Takip kodu paylaşılır",
    body: "Müşteriye bir takip kodu verilir. Aynı kod link ve QR olarak WhatsApp'tan tek dokunuşla gönderilir.",
    who: "Esnaf",
  },
  {
    title: "Her adım görünür",
    body: "Müşteri işin hangi aşamada olduğunu, ustanın eklediği fotoğrafları ve tahmini teslim zamanını görür.",
    who: "Müşteri",
  },
  {
    title: "Ek masraf onaya gelir",
    body: "Beklenmedik bir masraf çıkarsa usta teklif gönderir. Müşteri onaylar, reddeder ya da pazarlık eder.",
    who: "Esnaf ve müşteri",
  },
];

const FOR_CUSTOMER = [
  {
    title: "Üyelik ve uygulama gerekmez",
    body: "Takip kodu ya da link yeterli; tarayıcıdan açılır.",
  },
  {
    title: "Fotoğraflarla kanıt",
    body: "Değişen parçayı, yapılan işi kendi gözünüzle görün.",
  },
  {
    title: "Ek masraf önce size sorulur",
    body: "Onaylamadığınız hiçbir tutar faturaya eklenmez.",
  },
  {
    title: "Tek dokunuşla ulaşın",
    body: "Takip ekranından ustayı arayın ya da WhatsApp'tan yazın.",
  },
];

const FOR_MERCHANT = [
  {
    title: "Tüm aktif işler tek panelde",
    body: "Aşamaya göre filtreleyin, yanıt bekleyen teklifleri anında görün.",
  },
  {
    title: "Aşamayı tek dokunuşla ilerletin",
    body: "Müşteriye gidecek WhatsApp mesajı hazır gelir, fotoğraf eklemek saniyeler sürer.",
  },
  {
    title: "Pazarlık kayıt altında",
    body: "Kim hangi fiyatı ne zaman verdi; anlaşmazlığa yer kalmaz.",
  },
  {
    title: "Kod, link ve QR hazır",
    body: "İş kaydı açılınca paylaşım bağlantısı kendiliğinden oluşur.",
  },
];

const ROUNDS = [
  {
    tur: "Tur 1",
    who: "Usta teklif etti",
    amount: "3.400,00 ₺",
    note: "Orijinal parça, 2 adet disk",
  },
  {
    tur: "",
    who: "Müşteri önerdi",
    amount: "2.800,00 ₺",
    note: "“Yan sanayi parça olabilir mi?”",
  },
  {
    tur: "Tur 2",
    who: "Usta yeni fiyat verdi",
    amount: "3.100,00 ₺",
    note: "Muadil marka, 2 yıl garantili · Müşteri onayladı",
  },
];

const SECTORS = [
  { ab: "OS", name: "Oto servis" },
  { ab: "KB", name: "Kaporta ve boya" },
  { ab: "MD", name: "Mobilya ve döşeme" },
  { ab: "ET", name: "Elektronik tamiri" },
  { ab: "TT", name: "Tadilat ve tesisat" },
  { ab: "TR", name: "Terzi ve ayakkabı" },
];

const FAQ = [
  {
    q: "Müşteri olarak üye olmam gerekiyor mu?",
    a: "Hayır. Ustanızın verdiği takip kodunu girmeniz ya da gönderdiği linke dokunmanız yeterli.",
  },
  {
    q: "Takip kodumu kaybettim, ne yapmalıyım?",
    a: "İşi teslim ettiğiniz esnaftan kodu tekrar göndermesini isteyin; WhatsApp'tan tek dokunuşla iletebilir.",
  },
  {
    q: "Teklifi reddedersem ne olur?",
    a: "İş ek masraf olmadan devam eder ya da usta yeni bir fiyat önerir. Kararınız teklif geçmişinde saklanır.",
  },
  {
    q: "Pazarlık neden en fazla 3 tur?",
    a: "Sürecin uzamaması için. Üçüncü turun sonunda ya anlaşılır ya da teklif kapanır.",
  },
  {
    q: "Fotoğraflarımı kimler görebilir?",
    a: "Yalnızca takip linkine sahip olanlar ya da takip kodunu telefon numaranızın son 4 hanesiyle birlikte girenler. Linki ve kodu kimseyle paylaşmamanızı öneririz.",
  },
];

const NAV = [
  { href: "#nasil", label: "Nasıl çalışır" },
  { href: "#kimin", label: "Kimler için" },
  { href: "#teklif", label: "Teklif ve onay" },
  { href: "#sss", label: "SSS" },
];

function Eyebrow({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "text-sm font-bold tracking-[0.06em] text-ut-primary uppercase",
        className,
      )}
    >
      {children}
    </span>
  );
}

function CheckDot({ tone }: { tone: "success" | "accent" }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex size-7 shrink-0 items-center justify-center rounded-full",
        tone === "success"
          ? "bg-ut-success-tint text-ut-success"
          : "bg-ut-accent text-ut-text",
      )}
    >
      <IconCheck size={16} strokeWidth={2.6} />
    </span>
  );
}

/** Hero'daki dekoratif telefon önizlemesi (M2 ekranının küçük hali) */
function PhonePreview() {
  return (
    <div aria-hidden="true" className="flex flex-[1_1_340px] justify-center">
      <div className="w-[300px] rotate-[1.5deg] rounded-[36px] bg-[#1E1B4B] p-3 shadow-[0_30px_70px_-10px_rgba(15,23,42,.55)] ring-1 ring-white/10">
        <div className="flex flex-col overflow-hidden rounded-[26px] bg-ut-bg text-ut-text">
          <div className="flex items-center gap-2.5 border-b border-ut-border bg-ut-surface px-4 pt-4 pb-3">
            <span className="flex size-9 items-center justify-center rounded-[10px] bg-linear-to-br from-[#6366F1] to-ut-primary-hover text-[13px] font-bold text-white">
              YO
            </span>
            <span className="flex flex-col">
              <span className="text-sm font-bold">Yıldız Oto Servis</span>
              <span className="text-xs text-ut-text-muted">Kadıköy</span>
            </span>
          </div>
          <div className="flex flex-col gap-3 p-3.5">
            <div className="flex flex-col gap-2.5 rounded-ut bg-ut-surface p-3.5 shadow-ut">
              <span className="font-mono text-[11px] font-semibold text-ut-text-muted">
                UT-7K4M-29
              </span>
              <span className="text-[15px] font-bold">
                Fren ve debriyaj bakımı
              </span>
              <span className="inline-flex h-6 items-center gap-1.5 self-start rounded-full bg-ut-accent/20 px-2.5 text-xs font-semibold">
                <span className="size-[7px] rounded-full bg-ut-accent" />
                Onarım
              </span>
              <div className="flex gap-1">
                {["s", "s", "s", "a", "n", "n"].map((k, i) => (
                  <span
                    key={i}
                    className={cn(
                      "h-1.5 flex-1 rounded-[3px]",
                      k === "s"
                        ? "bg-ut-success"
                        : k === "a"
                          ? "bg-ut-accent"
                          : "bg-ut-border",
                    )}
                  />
                ))}
              </div>
              <span className="text-xs text-ut-text-muted">
                Tahmini teslim · 27 Kasım Cuma, 18:00
              </span>
            </div>
            <div className="flex gap-2.5 rounded-ut bg-ut-surface p-3 shadow-ut">
              <span className="ut-photo-placeholder flex size-16 shrink-0 items-center justify-center rounded-lg text-[9px] text-ut-text-muted">
                fotoğraf
              </span>
              <span className="flex flex-col gap-[3px]">
                <span className="text-[13px] font-semibold">
                  Ön balatalar değiştirildi
                </span>
                <span className="text-xs text-ut-text-muted">
                  Bugün 14:10 · 2 fotoğraf
                </span>
              </span>
            </div>
            <div className="flex items-center gap-2.5 rounded-ut border-[1.5px] border-ut-warning bg-ut-surface p-3">
              <span className="size-2 rounded-full bg-ut-warning" />
              <span className="flex-1 text-[13px] font-semibold">
                Onayınızı bekleyen teklif
              </span>
              <span className="text-[13px] font-bold">3.100,00 ₺</span>
            </div>
            <div className="flex gap-2">
              <span className="flex h-10 flex-1 items-center justify-center rounded-[10px] bg-ut-primary text-[13px] font-semibold text-white">
                Ara
              </span>
              <span className="flex h-10 flex-1 items-center justify-center rounded-[10px] bg-ut-whatsapp text-[13px] font-semibold text-white">
                WhatsApp
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** L1 · / — tanıtım ve ilk giriş */
export default function Home() {
  return (
    <div className="min-h-dvh bg-ut-bg text-ut-text">
      {/* Üst bar + hero */}
      <div className="relative overflow-hidden bg-linear-to-br from-ut-primary via-ut-primary-hover to-[#312E81] text-white">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(700px_380px_at_85%_10%,rgba(245,158,11,.20),transparent_70%),radial-gradient(600px_400px_at_0%_100%,rgba(129,140,248,.35),transparent_70%)]"
        />
        <header className="relative mx-auto box-border flex max-w-[1200px] items-center gap-4 px-6 py-3">
          <Link
            href="/"
            className="flex items-center gap-2.5 text-white no-underline hover:text-white"
          >
            <BrandMark />
            <span className="text-lg font-extrabold tracking-[-0.02em]">
              UstaTakip
            </span>
          </Link>
          <nav
            aria-label="Sayfa bölümleri"
            className="ml-4 hidden gap-1 min-[861px]:flex"
          >
            {NAV.map((n) => (
              <a
                key={n.href}
                href={n.href}
                className="rounded-lg px-3 py-2.5 text-[15px] font-medium text-white/90 no-underline transition hover:bg-white/10 hover:text-white"
              >
                {n.label}
              </a>
            ))}
          </nav>
          <span className="flex-1" />
          <Link
            href="/giris/"
            aria-label="Esnaf girişi"
            className="inline-flex h-11 items-center gap-2 rounded-ut border-[1.5px] border-white/60 px-4 text-[15px] font-semibold text-white no-underline transition hover:bg-white/10 hover:text-white"
          >
            <IconLogIn size={18} />
            <span>
              <span className="max-[860px]:hidden">Esnaf </span>Girişi
            </span>
          </Link>
          <ButtonLink
            href="/takip/"
            variant="accent"
            icon={<IconMapPin size={18} />}
            className="max-[420px]:hidden"
          >
            İş Takip
          </ButtonLink>
        </header>

        <section className="relative mx-auto box-border flex max-w-[1200px] flex-wrap items-center gap-12 px-6 pt-12 pb-[72px]">
          <div className="flex flex-[1_1_480px] flex-col gap-5">
            <span className="inline-flex h-[30px] items-center gap-2 self-start rounded-full bg-white/12 px-3 text-sm font-semibold ring-1 ring-white/15">
              <span className="size-2 rounded-full bg-ut-accent" />
              Esnaf ile müşteri arasında şeffaf iş takibi
            </span>
            <h1 className="m-0 text-[36px] leading-[1.08] font-extrabold tracking-[-0.03em] min-[861px]:text-[52px]">
              Ustadaki işiniz,
              <br />
              kargo gibi takipte.
            </h1>
            <p className="m-0 max-w-[520px] text-lg leading-[1.55] text-white/85">
              Aracınız serviste, koltuğunuz döşemecide ya da cihazınız tamirde…
              UstaTakip ile işin hangi aşamada olduğunu fotoğraflarıyla görür,
              ek masrafları önceden onaylarsınız. Telefonla sormaya gerek
              kalmaz.
            </p>

            <form
              role="search"
              aria-label="İş takip"
              action={`${BASE_PATH}/takip/`}
              method="get"
              className="mt-2 flex max-w-[520px] flex-wrap gap-2.5"
            >
              <label
                htmlFor="hero-code"
                className="flex-[1_0_100%] text-sm font-semibold text-white/85"
              >
                Takip kodunuz
              </label>
              <input
                id="hero-code"
                name="kod"
                type="text"
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                maxLength={20}
                placeholder="Örn. UT-7K4M-29"
                aria-describedby="hero-code-hint"
                className="box-border h-[52px] min-w-0 flex-[1_1_240px] rounded-ut border-0 bg-white px-4 font-mono text-[17px] tracking-[0.04em] text-ut-text shadow-[0_8px_24px_-8px_rgba(15,23,42,.4)] placeholder:text-ut-text-muted focus:ring-4 focus:ring-ut-accent/50 focus:outline-none"
              />
              <button
                type="submit"
                className="inline-flex h-[52px] flex-none cursor-pointer items-center gap-2 rounded-ut border-0 bg-ut-accent px-[22px] text-base font-bold text-ut-text shadow-[0_8px_24px_-8px_rgba(245,158,11,.6)] transition hover:brightness-105 active:translate-y-px"
              >
                İşimi Takip Et
                <IconArrowRight size={18} strokeWidth={2.4} />
              </button>
              <span
                id="hero-code-hint"
                className="flex-[1_0_100%] text-sm text-white/80"
              >
                Kod, ustanızın gönderdiği WhatsApp mesajında ya da fişteki QR
                kodda yazar.
              </span>
            </form>
          </div>

          <PhonePreview />
        </section>
      </div>

      <main>
        {/* Nasıl çalışır */}
        <section
          id="nasil"
          className="mx-auto box-border flex max-w-[1200px] scroll-mt-4 flex-col gap-8 px-6 pt-[72px] pb-6"
        >
          <div className="flex max-w-[640px] flex-col gap-2">
            <Eyebrow>Nasıl çalışır</Eyebrow>
            <h2 className="m-0 text-[34px] leading-[1.15] font-extrabold tracking-[-0.025em]">
              Dört adımda, baştan sona görünür iş
            </h2>
          </div>
          <ol className="m-0 grid list-none grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-4 p-0">
            {STEPS.map((s, i) => (
              <li
                key={s.title}
                className="flex flex-col gap-3 rounded-ut-lg border border-ut-border/80 bg-ut-surface p-6 shadow-ut transition duration-200 hover:-translate-y-0.5 hover:shadow-ut-lg"
              >
                <span
                  className={cn(
                    "flex size-10 items-center justify-center rounded-full text-[17px] font-bold",
                    i === 3
                      ? "bg-ut-accent text-ut-text"
                      : "bg-ut-primary text-white",
                  )}
                >
                  {i + 1}
                </span>
                <span className="text-lg font-bold">{s.title}</span>
                <span className="text-[15px] leading-[1.55] text-ut-text-muted">
                  {s.body}
                </span>
                <span className="mt-auto self-start rounded-full bg-ut-primary-soft px-2.5 py-[5px] text-[13px] font-semibold text-ut-primary">
                  {s.who}
                </span>
              </li>
            ))}
          </ol>
        </section>

        {/* Müşteriler için / Esnaflar için */}
        <section
          id="kimin"
          className="mx-auto box-border flex max-w-[1200px] scroll-mt-4 flex-wrap gap-5 px-6 pt-14 pb-6"
        >
          <div className="flex flex-[1_1_440px] flex-col gap-5 rounded-ut-lg border border-ut-border/80 bg-ut-surface p-8 shadow-ut max-[480px]:p-6">
            <div className="flex flex-col gap-1.5">
              <Eyebrow className="text-ut-text-muted">Müşteriler için</Eyebrow>
              <h2 className="m-0 text-[26px] font-extrabold tracking-[-0.02em]">
                “Ne oldu, ne zaman biter?” diye sormayın
              </h2>
            </div>
            <ul className="m-0 flex list-none flex-col gap-4 p-0">
              {FOR_CUSTOMER.map((f) => (
                <li key={f.title} className="flex gap-3.5">
                  <CheckDot tone="success" />
                  <span className="flex flex-col gap-[3px]">
                    <span className="text-base font-semibold">{f.title}</span>
                    <span className="text-[15px] leading-normal text-ut-text-muted">
                      {f.body}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
            <ButtonLink
              href="/takip/"
              variant="accent"
              className="mt-auto self-start"
            >
              İşimi takip et
            </ButtonLink>
          </div>

          <div className="relative flex flex-[1_1_440px] flex-col gap-5 overflow-hidden rounded-ut-lg bg-linear-to-br from-ut-primary to-[#312E81] p-8 text-white shadow-ut max-[480px]:p-6">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(420px_260px_at_100%_0%,rgba(245,158,11,.18),transparent_70%)]"
            />
            <div className="relative flex flex-col gap-1.5">
              <Eyebrow className="text-white/80">Esnaflar için</Eyebrow>
              <h2 className="m-0 text-[26px] font-extrabold tracking-[-0.02em]">
                Telefon trafiği azalsın, güven artsın
              </h2>
            </div>
            <ul className="relative m-0 flex list-none flex-col gap-4 p-0">
              {FOR_MERCHANT.map((f) => (
                <li key={f.title} className="flex gap-3.5">
                  <CheckDot tone="accent" />
                  <span className="flex flex-col gap-[3px]">
                    <span className="text-base font-semibold">{f.title}</span>
                    <span className="text-[15px] leading-normal text-white/80">
                      {f.body}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
            <Link
              href="/giris/"
              className="relative mt-auto inline-flex h-11 items-center self-start rounded-ut bg-white px-[18px] text-[15px] font-semibold text-ut-primary no-underline transition hover:bg-ut-primary-soft hover:text-ut-primary"
            >
              Esnaf paneline gir
            </Link>
          </div>
        </section>

        {/* Teklif ve onay */}
        <section
          id="teklif"
          className="mx-auto box-border flex max-w-[1200px] scroll-mt-4 flex-wrap items-center gap-10 px-6 pt-[72px] pb-6"
        >
          <div className="flex flex-[1_1_420px] flex-col gap-4">
            <Eyebrow>Teklif ve onay</Eyebrow>
            <h2 className="m-0 text-[34px] leading-[1.15] font-extrabold tracking-[-0.025em]">
              Sürpriz fatura yok.
              <br />
              Her ek masraf sizin onayınızla.
            </h2>
            <p className="m-0 text-[17px] leading-[1.6] text-ut-text-muted">
              İş sırasında yeni bir parça ya da ek işçilik gerekirse usta
              açıklamasıyla birlikte teklif gönderir. Siz onaylar, reddeder ya
              da kendi fiyatınızı önerirsiniz. Pazarlık{" "}
              <strong className="text-ut-text">en fazla 3 tur</strong> sürer ve
              her adım kayıt altında kalır.
            </p>
            <div aria-hidden="true" className="flex flex-wrap gap-2">
              <span className="inline-flex h-9 items-center rounded-[10px] bg-ut-primary px-3.5 text-sm font-semibold text-white">
                Onayla
              </span>
              <span className="inline-flex h-9 items-center rounded-[10px] border-[1.5px] border-ut-danger px-3.5 text-sm font-semibold text-ut-danger">
                Reddet
              </span>
              <span className="inline-flex h-9 items-center rounded-[10px] border border-ut-border bg-ut-surface px-3.5 text-sm font-semibold">
                Pazarlık Yap
              </span>
            </div>
          </div>
          <figure
            aria-label="Örnek teklif geçmişi"
            className="m-0 flex flex-[1_1_420px] flex-col gap-4 rounded-ut-lg border border-ut-border/80 bg-ut-surface p-6 shadow-ut-lg"
          >
            <div className="flex items-center justify-between gap-3">
              <span className="text-base font-bold">
                Ön fren diski değişimi
              </span>
              <StatusBadge tone="success" size="sm">
                Onaylandı
              </StatusBadge>
            </div>
            <div aria-hidden="true" className="flex gap-1">
              <span className="h-1.5 flex-1 rounded-[3px] bg-ut-primary" />
              <span className="h-1.5 flex-1 rounded-[3px] bg-ut-primary" />
              <span className="h-1.5 flex-1 rounded-[3px] bg-ut-border" />
            </div>
            {ROUNDS.map((r, i) => (
              <div key={i} className="flex items-start gap-3">
                <span className="w-14 shrink-0 pt-[3px] text-[13px] font-bold text-ut-text-muted">
                  {r.tur}
                </span>
                <div className="flex flex-1 flex-col gap-1 border-b border-ut-border pb-3.5">
                  <span className="flex justify-between gap-2 text-[15px]">
                    <span>{r.who}</span>
                    <strong>{r.amount}</strong>
                  </span>
                  <span className="text-sm text-ut-text-muted">{r.note}</span>
                </div>
              </div>
            ))}
            <figcaption className="text-[13px] text-ut-text-muted">
              Tur 3 kullanılmadı · Anlaşılan tutar 3.100,00 ₺
            </figcaption>
          </figure>
        </section>

        {/* Sektörler */}
        <section className="mx-auto box-border flex max-w-[1200px] flex-col gap-5 px-6 pt-[72px] pb-6">
          <h2 className="m-0 text-[26px] font-extrabold tracking-[-0.02em]">
            Aşamalı çalışan her esnaf için
          </h2>
          <p className="m-0 max-w-[640px] text-base leading-[1.55] text-ut-text-muted">
            Aşamaları esnaf kendisi belirler: oto serviste “Arıza Tespiti”,
            mobilyacıda “Kesim ve Montaj”, terzide “Prova”.
          </p>
          <ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-3 p-0">
            {SECTORS.map((x) => (
              <li
                key={x.ab}
                className="box-border flex min-h-16 items-center gap-3 rounded-ut border border-ut-border bg-ut-surface px-4 py-3.5 text-[15px] font-semibold"
              >
                <span
                  aria-hidden="true"
                  className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-ut-primary-soft text-[13px] font-bold text-ut-primary"
                >
                  {x.ab}
                </span>
                {x.name}
              </li>
            ))}
          </ul>
        </section>

        {/* SSS */}
        <section
          id="sss"
          className="mx-auto box-border flex max-w-[1200px] scroll-mt-4 flex-wrap gap-8 px-6 pt-[72px] pb-6"
        >
          <div className="flex flex-[1_1_280px] flex-col gap-2">
            <Eyebrow>SSS</Eyebrow>
            <h2 className="m-0 text-[34px] leading-[1.15] font-extrabold tracking-[-0.025em]">
              Sık sorulan sorular
            </h2>
          </div>
          <div className="flex flex-[999_1_560px] flex-col gap-2.5">
            {FAQ.map((f) => (
              <details
                key={f.q}
                className="group rounded-ut border border-ut-border bg-ut-surface transition open:shadow-ut"
              >
                <summary className="box-border flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-[18px] py-3.5 text-base font-semibold [&::-webkit-details-marker]:hidden">
                  {f.q}
                  <IconChevronDown
                    size={20}
                    className="shrink-0 text-ut-text-muted transition-transform duration-150 group-open:rotate-180"
                  />
                </summary>
                <p className="m-0 px-[18px] pb-[18px] text-[15px] leading-[1.6] text-ut-text-muted">
                  {f.a}
                </p>
              </details>
            ))}
          </div>
        </section>

        {/* Son çağrı */}
        <section className="mx-auto box-border max-w-[1200px] px-6 py-[72px]">
          <div className="flex flex-wrap items-center justify-between gap-6 rounded-ut-lg bg-ut-primary-soft px-8 py-10 ring-1 ring-ut-primary/10 max-[480px]:px-6">
            <div className="flex flex-[1_1_420px] flex-col gap-2">
              <h2 className="m-0 text-[28px] font-extrabold tracking-[-0.02em] text-ut-primary">
                Elinizde takip kodu mu var?
              </h2>
              <p className="m-0 text-base leading-[1.55]">
                Kodu girin, işinizin son durumunu hemen görün. Esnafsanız
                panelinize giriş yapıp işlerinizi yönetin.
              </p>
            </div>
            <div className="flex flex-wrap gap-2.5">
              <ButtonLink
                href="/takip/"
                variant="accent"
                size="lg"
                className="font-bold"
              >
                İşimi Takip Et
              </ButtonLink>
              <ButtonLink href="/giris/" size="lg">
                Esnaf Girişi
              </ButtonLink>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-ut-border bg-ut-surface">
        <div className="mx-auto box-border flex max-w-[1200px] flex-wrap items-center justify-between gap-x-6 gap-y-3 p-6 text-sm text-ut-text-muted">
          <span>
            <strong className="text-ut-text">UstaTakip</strong> · © 2026 · Proje
            ödevi, demo verilerle çalışır
          </span>
          <nav
            aria-label="Alt bağlantılar"
            className="flex flex-wrap gap-x-5 gap-y-1"
          >
            <Link href="/takip/" className="py-2 text-ut-text-muted">
              İş takip
            </Link>
            <Link href="/giris/" className="py-2 text-ut-text-muted">
              Esnaf girişi
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
