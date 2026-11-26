export type NotifyChannel = "wa_link" | "whatsapp_cloud" | "sms";
export type JobStatus = "active" | "delivered" | "cancelled";
export type OfferStatus =
  "pending" | "accepted" | "rejected" | "countered" | "expired";

export type Business = {
  id: string;
  owner_id: string;
  name: string;
  tagline: string | null;
  phone: string | null;
  logo_path: string | null;
  notify_channel: NotifyChannel;
  kvkk_text: string | null;
  /** Esnafın düzenlediği WhatsApp mesajları; yalnızca varsayılandan farklı olanlar */
  message_templates: Partial<
    Record<
      | "job_created"
      | "stage_changed"
      | "offer_sent"
      | "job_ready"
      | "job_delivered",
      string
    >
  > | null;
  created_at: string;
};

export type TemplateStage = {
  id: string;
  template_id: string;
  name: string;
  position: number;
  color: string;
};

export type ProcessTemplate = {
  id: string;
  business_id: string | null;
  name: string;
  sector: string;
  created_at: string;
  template_stages?: TemplateStage[];
};

export type Job = {
  id: string;
  business_id: string;
  template_id: string;
  customer_name: string;
  customer_phone: string;
  title: string;
  item_label: string | null;
  description: string | null;
  agreed_amount: number | null;
  estimated_delivery: string | null;
  current_stage_id: string | null;
  status: JobStatus;
  tracking_code: string;
  tracking_token: string;
  token_expires_at: string | null;
  created_at: string;
  updated_at: string;
  delivered_at: string | null;
};
