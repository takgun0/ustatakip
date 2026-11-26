import { describe, expect, it } from "vitest";
import {
  NotificationService,
  SmsProvider,
  WaMeLinkProvider,
  WhatsAppCloudProvider,
  renderMessage,
  waMeLink,
  type NotificationEvent,
} from "./notifications";

const base = { businessName: "Yıldız Oto Servis", customerName: "Ayşe Kaya", title: "Fren bakımı", url: "https://x.test/t/#abc" };

describe("renderMessage", () => {
  it("iş kaydında kod ve link içerir, ilk adla hitap eder", () => {
    const text = renderMessage({ type: "job_created", ...base, trackingCode: "UT-7K4M-29" });
    expect(text).toMatch(/^Merhaba Ayşe,/);
    expect(text).toContain("UT-7K4M-29");
    expect(text).toContain(base.url);
  });

  it("teklif tutarını 1.250,00 ₺ biçiminde yazar", () => {
    const text = renderMessage({ type: "offer_sent", ...base, offerTitle: "Balata değişimi", amount: 125000 });
    expect(text).toContain("1.250,00 ₺");
    expect(text).toContain("Balata değişimi");
  });

  it("beş tetikleyicinin hepsi için metin üretir", () => {
    const events: NotificationEvent[] = [
      { type: "job_created", ...base, trackingCode: "UT-1" },
      { type: "stage_changed", ...base, stageName: "Tamir" },
      { type: "offer_sent", ...base, offerTitle: "X", amount: 100 },
      { type: "counter_received", customerName: "Ayşe Kaya", trackingCode: "UT-1", amount: 90000, url: base.url },
      { type: "job_ready", ...base },
      { type: "job_delivered", businessName: base.businessName, customerName: base.customerName, title: base.title },
    ];
    for (const e of events) expect(renderMessage(e).length).toBeGreaterThan(20);
    expect(renderMessage(events[3])).toContain("900,00 ₺");
  });
});

describe("job_delivered", () => {
  it("teslim mesajı ilk adla hitap eder, iş ve işletme adını içerir, link içermez", () => {
    const text = renderMessage({ type: "job_delivered", businessName: base.businessName, customerName: base.customerName, title: base.title });
    expect(text).toContain("Merhaba Ayşe");
    expect(text).toContain('"Fren bakımı" işiniz tamamlandı ve teslim edildi');
    expect(text).toContain("Yıldız Oto Servis");
    expect(text).not.toContain("http");
  });
});

describe("waMeLink", () => {
  it("numarayı + olmadan ekler ve metni kodlar", () => {
    expect(waMeLink("a b&c", "+905321112233")).toBe("https://wa.me/905321112233?text=a%20b%26c");
  });
  it("numara yoksa kişi seçtiren link üretir", () => {
    expect(waMeLink("selam")).toBe("https://wa.me/?text=selam");
  });
});

describe("NotificationService", () => {
  const event: NotificationEvent = { type: "job_ready", ...base };

  it("wa_link kanalında link döner", async () => {
    const r = await new NotificationService().notify(event, "+905321112233", "wa_link");
    expect(r.status).toBe("link");
    if (r.status === "link") expect(r.url.startsWith("https://wa.me/905321112233?text=")).toBe(true);
  });

  it("taslak kanallar kullanılamaz ve wa.me linkine düşer", async () => {
    expect((await new WhatsAppCloudProvider().send({ to: "+90", text: "x", event: "job_ready" })).status).toBe("unavailable");
    expect((await new SmsProvider().send({ to: "+90", text: "x", event: "job_ready" })).status).toBe("unavailable");
    const service = new NotificationService();
    expect((await service.notify(event, "+905321112233", "sms")).status).toBe("link");
    expect((await service.notify(event, "+905321112233", "whatsapp_cloud")).status).toBe("link");
  });

  it("çalışan bir sağlayıcı varsa onu kullanır", async () => {
    const service = new NotificationService([
      new WaMeLinkProvider(),
      { channel: "sms", send: async () => ({ status: "sent", channel: "sms", id: "m1" }) },
    ]);
    expect(await service.notify(event, "+905321112233", "sms")).toEqual({ status: "sent", channel: "sms", id: "m1" });
  });
});
