import { formatTRY } from "./money.ts";

/**
 * Bildirim servisi. MVP'de mesajlar wa.me linki olarak hazırlanır: esnaf kendi WhatsApp'ından
 * tek dokunuşla gönderir, sistem hiçbir şeyi kendiliğinden göndermez.
 * WhatsApp Cloud API ve SMS sağlayıcıları arayüzü uygulayan taslaklardır (stub).
 *
 * Bu dosya Edge Function'lara da kopyalanır: yalnızca göreli ".ts" importları kullanın.
 */

export type NotifyChannel = "wa_link" | "whatsapp_cloud" | "sms";

/** Bildirimi tetikleyen olaylar */
export type NotificationEvent =
  | { type: "job_created"; businessName: string; customerName: string; title: string; trackingCode: string; url: string }
  | { type: "stage_changed"; businessName: string; customerName: string; title: string; stageName: string; url: string }
  | { type: "offer_sent"; businessName: string; customerName: string; title: string; offerTitle: string; amount: number; url: string }
  | { type: "counter_received"; customerName: string; trackingCode: string; amount: number; url: string }
  | { type: "job_ready"; businessName: string; customerName: string; title: string; url: string };

export type NotificationType = NotificationEvent["type"];

export type OutgoingMessage = {
  /** E.164 (+905xxxxxxxxx). Karşı teklifte alıcı esnaftır. */
  to: string;
  text: string;
  event: NotificationType;
};

export type DeliveryResult =
  | { status: "link"; channel: NotifyChannel; url: string }
  | { status: "sent"; channel: NotifyChannel; id: string }
  | { status: "unavailable"; channel: NotifyChannel; reason: string };

export interface NotificationProvider {
  readonly channel: NotifyChannel;
  send(message: OutgoingMessage): Promise<DeliveryResult>;
}

function firstName(full: string): string {
  return full.trim().split(/\s+/)[0] ?? full;
}

/** Olaya göre Türkçe mesaj metni */
export function renderMessage(event: NotificationEvent): string {
  switch (event.type) {
    case "job_created":
      return `Merhaba ${firstName(event.customerName)}, ${event.businessName} olarak "${event.title}" işinizi kaydettik. Takip kodunuz: ${event.trackingCode}. İşinizin durumunu buradan izleyebilirsiniz: ${event.url}`;
    case "stage_changed":
      return `Merhaba ${firstName(event.customerName)}, "${event.title}" işiniz "${event.stageName}" aşamasına geçti. Ayrıntılar: ${event.url} — ${event.businessName}`;
    case "offer_sent":
      return `Merhaba ${firstName(event.customerName)}, "${event.title}" işiniz için ek bir işlem öneriyoruz: ${event.offerTitle} — ${formatTRY(event.amount)}. Onaylamak, reddetmek ya da karşı teklif vermek için: ${event.url} — ${event.businessName}`;
    case "counter_received":
      return `${event.customerName} (${event.trackingCode}) teklifinize ${formatTRY(event.amount)} karşı teklif verdi. Yanıtlamak için: ${event.url}`;
    case "job_ready":
      return `Merhaba ${firstName(event.customerName)}, "${event.title}" işiniz hazır! Teslim almak için sizi bekliyoruz. Ayrıntılar: ${event.url} — ${event.businessName}`;
  }
}

/** https://wa.me/905xxxxxxxxx?text=… — numara yoksa WhatsApp kişi seçtirir */
export function waMeLink(text: string, to?: string | null): string {
  const number = to ? to.replace(/\D/g, "") : "";
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
}

export class WaMeLinkProvider implements NotificationProvider {
  readonly channel = "wa_link" as const;
  async send(message: OutgoingMessage): Promise<DeliveryResult> {
    return { status: "link", channel: this.channel, url: waMeLink(message.text, message.to) };
  }
}

/** Taslak: Meta WhatsApp Cloud API (şablon mesaj onayı ve işletme hesabı gerekir) */
export class WhatsAppCloudProvider implements NotificationProvider {
  readonly channel = "whatsapp_cloud" as const;
  constructor(private readonly config?: { phoneNumberId: string; accessToken: string }) {}
  async send(_message: OutgoingMessage): Promise<DeliveryResult> {
    void _message;
    return {
      status: "unavailable",
      channel: this.channel,
      reason: this.config ? "WhatsApp Cloud API entegrasyonu henüz etkin değil" : "WhatsApp Cloud API yapılandırılmadı",
    };
  }
}

/** Taslak: SMS sağlayıcısı (Netgsm, İleti Merkezi vb.) */
export class SmsProvider implements NotificationProvider {
  readonly channel = "sms" as const;
  constructor(private readonly config?: { apiKey: string; sender: string }) {}
  async send(_message: OutgoingMessage): Promise<DeliveryResult> {
    void _message;
    return {
      status: "unavailable",
      channel: this.channel,
      reason: this.config ? "SMS entegrasyonu henüz etkin değil" : "SMS sağlayıcısı yapılandırılmadı",
    };
  }
}

export class NotificationService {
  private readonly providers: Map<NotifyChannel, NotificationProvider>;

  constructor(providers: NotificationProvider[] = [new WaMeLinkProvider(), new WhatsAppCloudProvider(), new SmsProvider()]) {
    this.providers = new Map(providers.map((p) => [p.channel, p]));
  }

  /**
   * Mesajı seçili kanaldan iletir. Kanal kullanılamıyorsa wa.me linkine düşer;
   * böylece esnaf her durumda mesajı elle gönderebilir.
   */
  async notify(event: NotificationEvent, to: string, channel: NotifyChannel = "wa_link"): Promise<DeliveryResult> {
    const message: OutgoingMessage = { to, text: renderMessage(event), event: event.type };
    const provider = this.providers.get(channel);
    const result = provider ? await provider.send(message) : null;
    if (result && result.status !== "unavailable") return result;
    const fallback = this.providers.get("wa_link") ?? new WaMeLinkProvider();
    return fallback.send(message);
  }
}
