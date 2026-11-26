-- Esnafın düzenleyebildiği WhatsApp mesaj şablonları (E7 Ayarlar).
-- Yalnızca varsayılandan farklı olanlar saklanır: { "job_created": "Merhaba {müşteri}…", … }
-- Boş nesne = tüm mesajlar varsayılan metinle üretilir (src/lib/notifications.ts).
-- Kısıtlar: yalnızca bilinen anahtarlar, değerler metin, toplam boyut sınırlı.
-- Güncelleme mevcut businesses_update politikasıyla yalnızca işletme sahibine açıktır.

alter table public.businesses
  add column message_templates jsonb not null default '{}'::jsonb;

alter table public.businesses
  add constraint businesses_message_templates_check check (
    jsonb_typeof(message_templates) = 'object'
    and message_templates - array['job_created', 'stage_changed', 'offer_sent', 'job_ready', 'job_delivered'] = '{}'::jsonb
    and not jsonb_path_exists(message_templates, '$.* ? (@.type() != "string")')
    and octet_length(message_templates::text) <= 8000
  );
