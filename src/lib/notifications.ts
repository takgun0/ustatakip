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
  | {
      type: "job_created";
      businessName: string;
      customerName: string;
      title: string;
      trackingCode: string;
      url: string;
    }
  | {
      type: "stage_changed";
      businessName: string;
      customerName: string;
      title: string;
      stageName: string;
      url: string;
    }
  | {
      type: "offer_sent";
      businessName: string;
      customerName: string;
      title: string;
      offerTitle: string;
      amount: number;
      url: string;
    }
  | {
      type: "counter_received";
      customerName: string;
      trackingCode: string;
      amount: number;
      url: string;
    }
  | {
      type: "job_ready";
      businessName: string;
      customerName: string;
      title: string;
      url: string;
    }
  | {
      type: "job_delivered";
      businessName: string;
      customerName: string;
      title: string;
    };

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

/** Esnafın düzenleyebildiği mesajlar. Karşı teklif bildirimi müşteriden esnafa gittiği için sabittir. */
export type EditableMessageType = Exclude<NotificationType, "counter_received">;
export const EDITABLE_MESSAGE_TYPES: readonly EditableMessageType[] = [
  "job_created",
  "stage_changed",
  "offer_sent",
  "job_ready",
  "job_delivered",
];

/** businesses.message_templates: yalnızca varsayılandan farklı şablonlar saklanır */
export type MessageTemplates = Partial<Record<EditableMessageType, string>>;

export const TEMPLATE_MAX_LENGTH = 1000;

/** Varsayılan metinler. {alan} yer tutucuları mesaj üretilirken doldurulur. */
export const DEFAULT_TEMPLATES: Record<EditableMessageType, string> = {
  job_created:
    'Merhaba {müşteri}, {işletme} olarak "{iş}" işinizi kaydettik. Takip kodunuz: {kod}. İşinizin durumunu buradan izleyebilirsiniz: {link}',
  stage_changed:
    'Merhaba {müşteri}, "{iş}" işiniz "{aşama}" aşamasına geçti. Ayrıntılar: {link} — {işletme}',
  offer_sent:
    'Merhaba {müşteri}, "{iş}" işiniz için ek bir işlem öneriyoruz: {teklif} — {tutar}. Onaylamak, reddetmek ya da karşı teklif vermek için: {link} — {işletme}',
  job_ready:
    'Merhaba {müşteri}, "{iş}" işiniz hazır! Teslim almak için sizi bekliyoruz. Ayrıntılar: {link} — {işletme}',
  job_delivered:
    'Merhaba {müşteri}, "{iş}" işiniz tamamlandı ve teslim edildi. Bizi tercih ettiğiniz için teşekkür ederiz. — {işletme}',
};

/** Her mesajda kullanılabilen alanlar (ayarlar ekranındaki düğmeler ve uyarılar için) */
export const TEMPLATE_FIELDS: Record<EditableMessageType, readonly string[]> = {
  job_created: ["müşteri", "iş", "kod", "link", "işletme"],
  stage_changed: ["müşteri", "iş", "aşama", "link", "işletme"],
  offer_sent: ["müşteri", "iş", "teklif", "tutar", "link", "işletme"],
  job_ready: ["müşteri", "iş", "link", "işletme"],
  job_delivered: ["müşteri", "iş", "işletme"],
};

const PLACEHOLDER = /\{([^{}\n]{1,20})\}/g;

/** Şablondaki {alan}'ları doldurur. Bilinmeyen alan olduğu gibi kalır; değerler yeniden taranmaz. */
export function fillTemplate(
  template: string,
  values: Record<string, string>,
): string {
  return template.replace(
    PLACEHOLDER,
    (match, key: string) => values[key.trim().toLocaleLowerCase("tr")] ?? match,
  );
}

/** Şablonda geçen ama o mesajda karşılığı olmayan alanlar */
export function unknownFields(
  type: EditableMessageType,
  template: string,
): string[] {
  const allowed = new Set(TEMPLATE_FIELDS[type]);
  const out = new Set<string>();
  for (const m of template.matchAll(PLACEHOLDER)) {
    const key = m[1]!.trim().toLocaleLowerCase("tr");
    if (!allowed.has(key)) out.add(m[1]!);
  }
  return [...out];
}

function fieldValues(
  event: Exclude<NotificationEvent, { type: "counter_received" }>,
): Record<string, string> {
  const base: Record<string, string> = {
    müşteri: firstName(event.customerName),
    iş: event.title,
    işletme: event.businessName,
  };
  switch (event.type) {
    case "job_created":
      return { ...base, kod: event.trackingCode, link: event.url };
    case "stage_changed":
      return { ...base, aşama: event.stageName, link: event.url };
    case "offer_sent":
      return {
        ...base,
        teklif: event.offerTitle,
        tutar: formatTRY(event.amount),
        link: event.url,
      };
    case "job_ready":
      return { ...base, link: event.url };
    case "job_delivered":
      return base;
  }
}

/**
 * Olaya göre Türkçe mesaj metni. İşletmenin kendi şablonu varsa (boş değilse) o kullanılır,
 * yoksa varsayılan metin.
 */
export function renderMessage(
  event: NotificationEvent,
  templates?: MessageTemplates | null,
): string {
  if (event.type === "counter_received") {
    return `${event.customerName} (${event.trackingCode}) teklifinize ${formatTRY(event.amount)} karşı teklif verdi. Yanıtlamak için: ${event.url}`;
  }
  const custom = templates?.[event.type]?.trim();
  return fillTemplate(
    custom || DEFAULT_TEMPLATES[event.type],
    fieldValues(event),
  );
}

/** https://wa.me/905xxxxxxxxx?text=… — numara yoksa WhatsApp kişi seçtirir */
export function waMeLink(text: string, to?: string | null): string {
  const number = to ? to.replace(/\D/g, "") : "";
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
}

export class WaMeLinkProvider implements NotificationProvider {
  readonly channel = "wa_link" as const;
  async send(message: OutgoingMessage): Promise<DeliveryResult> {
    return {
      status: "link",
      channel: this.channel,
      url: waMeLink(message.text, message.to),
    };
  }
}

/** Taslak: Meta WhatsApp Cloud API (şablon mesaj onayı ve işletme hesabı gerekir) */
export class WhatsAppCloudProvider implements NotificationProvider {
  readonly channel = "whatsapp_cloud" as const;
  constructor(
    private readonly config?: { phoneNumberId: string; accessToken: string },
  ) {}
  async send(_message: OutgoingMessage): Promise<DeliveryResult> {
    void _message;
    return {
      status: "unavailable",
      channel: this.channel,
      reason: this.config
        ? "WhatsApp Cloud API entegrasyonu henüz etkin değil"
        : "WhatsApp Cloud API yapılandırılmadı",
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
      reason: this.config
        ? "SMS entegrasyonu henüz etkin değil"
        : "SMS sağlayıcısı yapılandırılmadı",
    };
  }
}

export class NotificationService {
  private readonly providers: Map<NotifyChannel, NotificationProvider>;

  constructor(
    providers: NotificationProvider[] = [
      new WaMeLinkProvider(),
      new WhatsAppCloudProvider(),
      new SmsProvider(),
    ],
  ) {
    this.providers = new Map(providers.map((p) => [p.channel, p]));
  }

  /**
   * Mesajı seçili kanaldan iletir. Kanal kullanılamıyorsa wa.me linkine düşer;
   * böylece esnaf her durumda mesajı elle gönderebilir.
   */
  async notify(
    event: NotificationEvent,
    to: string,
    channel: NotifyChannel = "wa_link",
  ): Promise<DeliveryResult> {
    const message: OutgoingMessage = {
      to,
      text: renderMessage(event),
      event: event.type,
    };
    const provider = this.providers.get(channel);
    const result = provider ? await provider.send(message) : null;
    if (result && result.status !== "unavailable") return result;
    const fallback = this.providers.get("wa_link") ?? new WaMeLinkProvider();
    return fallback.send(message);
  }
}
