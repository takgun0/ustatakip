-- UstaTakip · Faz 1 · Şema, RLS, tetikleyiciler
-- Tutarlar kuruş cinsinden bigint olarak saklanır.

create extension if not exists pgcrypto with schema extensions;

-- ─────────────────────────────────────────────────────────────
-- Tipler
-- ─────────────────────────────────────────────────────────────
create type public.job_status as enum ('active', 'delivered', 'cancelled');
create type public.offer_status as enum ('pending', 'accepted', 'rejected', 'countered', 'expired');
create type public.offer_actor as enum ('business', 'customer');
create type public.offer_action as enum ('propose', 'counter', 'accept', 'reject');
create type public.notify_channel as enum ('wa_link', 'whatsapp_cloud', 'sms');

-- ─────────────────────────────────────────────────────────────
-- Tablolar
-- ─────────────────────────────────────────────────────────────
create table public.businesses (
  id             uuid primary key default gen_random_uuid(),
  owner_id       uuid not null unique references auth.users (id) on delete cascade,
  name           text not null check (char_length(name) between 2 and 80),
  tagline        text check (char_length(tagline) <= 80),
  phone          text check (phone ~ '^\+[1-9][0-9]{9,14}$'),
  logo_path      text,
  notify_channel public.notify_channel not null default 'wa_link',
  kvkk_text      text check (char_length(kvkk_text) <= 5000),
  created_at     timestamptz not null default now()
);

-- business_id NULL = herkese açık hazır şablon (seed)
create table public.process_templates (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses (id) on delete cascade,
  name        text not null check (char_length(name) between 2 and 60),
  sector      text not null check (char_length(sector) between 2 and 40),
  created_at  timestamptz not null default now()
);
create index on public.process_templates (business_id);

create table public.template_stages (
  id          uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.process_templates (id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 40),
  position    integer not null check (position >= 0),
  color       text not null default '#1E3A5F' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  constraint template_stages_position_key unique (template_id, position) deferrable initially immediate
);

create table public.jobs (
  id                 uuid primary key default gen_random_uuid(),
  business_id        uuid not null references public.businesses (id) on delete cascade,
  template_id        uuid not null references public.process_templates (id) on delete restrict,
  customer_name      text not null check (char_length(customer_name) between 2 and 80),
  customer_phone     text not null check (customer_phone ~ '^\+[1-9][0-9]{9,14}$'),
  title              text not null check (char_length(title) between 2 and 120),
  item_label         text check (char_length(item_label) <= 120),
  description        text check (char_length(description) <= 2000),
  agreed_amount      bigint check (agreed_amount >= 0),
  estimated_delivery timestamptz,
  current_stage_id   uuid references public.template_stages (id) on delete restrict,
  status             public.job_status not null default 'active',
  tracking_code      text not null unique check (tracking_code ~ '^UT-[0-9A-HJKMNP-TV-Z]{6}$'),
  tracking_token     text not null unique check (char_length(tracking_token) >= 22),
  token_expires_at   timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  delivered_at       timestamptz
);
create index on public.jobs (business_id, status);

create table public.job_stage_events (
  id         uuid primary key default gen_random_uuid(),
  job_id     uuid not null references public.jobs (id) on delete cascade,
  stage_id   uuid not null references public.template_stages (id) on delete restrict,
  note       text check (char_length(note) <= 1000),
  entered_at timestamptz not null default now()
);
create index on public.job_stage_events (job_id, entered_at);

create table public.job_media (
  id           uuid primary key default gen_random_uuid(),
  job_id       uuid not null references public.jobs (id) on delete cascade,
  stage_id     uuid references public.template_stages (id) on delete set null,
  storage_path text not null unique,
  caption      text check (char_length(caption) <= 200),
  created_at   timestamptz not null default now()
);
create index on public.job_media (job_id);

create table public.offers (
  id             uuid primary key default gen_random_uuid(),
  job_id         uuid not null references public.jobs (id) on delete cascade,
  title          text not null check (char_length(title) between 2 and 120),
  description    text check (char_length(description) <= 2000),
  status         public.offer_status not null default 'pending',
  current_amount bigint not null check (current_amount > 0),
  final_amount   bigint check (final_amount > 0),
  created_at     timestamptz not null default now()
);
create index on public.offers (job_id);

create table public.offer_rounds (
  id         uuid primary key default gen_random_uuid(),
  offer_id   uuid not null references public.offers (id) on delete cascade,
  round_no   smallint not null check (round_no between 1 and 3),
  actor      public.offer_actor not null,
  action     public.offer_action not null,
  amount     bigint check (amount > 0),
  note       text check (char_length(note) <= 500),
  ip_hash    text,
  created_at timestamptz not null default now()
);
create index on public.offer_rounds (offer_id, created_at);

create table public.ratings (
  job_id     uuid primary key references public.jobs (id) on delete cascade,
  score      smallint not null check (score between 1 and 5),
  comment    text check (char_length(comment) <= 1000),
  created_at timestamptz not null default now()
);

-- Sunucu tarafı (Edge Function) rate limit sayaçları
create table public.rate_limits (
  key          text primary key,
  window_start timestamptz not null default now(),
  count        integer not null default 0
);

-- ─────────────────────────────────────────────────────────────
-- Yardımcı fonksiyonlar
-- ─────────────────────────────────────────────────────────────
create or replace function public.auth_business_id()
returns uuid
language sql stable security definer set search_path = ''
as $$
  select b.id from public.businesses b where b.owner_id = (select auth.uid())
$$;
revoke execute on function public.auth_business_id() from public, anon;
grant execute on function public.auth_business_id() to authenticated;

-- Realtime kanal adı: token'ın kendisi değil SHA-256 özeti
create or replace function public.job_topic(p_token text)
returns text
language sql immutable set search_path = ''
as $$
  select 'job:' || encode(extensions.digest(p_token, 'sha256'), 'hex')
$$;

-- IP başına sabit pencere sayacı. true = izin verildi.
create or replace function public.hit_rate_limit(p_key text, p_limit integer, p_window_seconds integer)
returns boolean
language plpgsql security definer set search_path = ''
as $$
declare
  v_count integer;
begin
  insert into public.rate_limits as r (key, window_start, count)
  values (p_key, now(), 1)
  on conflict (key) do update set
    count = case when r.window_start < now() - make_interval(secs => p_window_seconds) then 1 else r.count + 1 end,
    window_start = case when r.window_start < now() - make_interval(secs => p_window_seconds) then now() else r.window_start end
  returning count into v_count;
  return v_count <= p_limit;
end
$$;
revoke execute on function public.hit_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.hit_rate_limit(text, integer, integer) to service_role;

-- ─────────────────────────────────────────────────────────────
-- Tetikleyiciler
-- ─────────────────────────────────────────────────────────────

-- jobs: değişmez kolonlar, updated_at, teslim/iptal sonrası işlemler
create or replace function public.jobs_before_update()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if new.business_id <> old.business_id
     or new.tracking_code <> old.tracking_code
     or new.tracking_token <> old.tracking_token
     or new.template_id <> old.template_id
     or new.created_at <> old.created_at then
    raise exception 'Bu alanlar değiştirilemez' using errcode = '42501';
  end if;

  if new.status = 'delivered' and old.status <> 'delivered' then
    new.delivered_at := now();
    new.token_expires_at := now() + interval '30 days';
  elsif new.status <> 'delivered' then
    new.delivered_at := null;
    new.token_expires_at := null;
  else
    new.delivered_at := old.delivered_at;
    new.token_expires_at := old.token_expires_at;
  end if;

  new.updated_at := now();
  return new;
end
$$;
create trigger jobs_before_update before update on public.jobs
  for each row execute function public.jobs_before_update();

-- İş kapanınca yanıt bekleyen teklifler expired olur
create or replace function public.jobs_after_close()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.status <> 'active' and old.status = 'active' then
    update public.offers set status = 'expired'
     where job_id = new.id and status in ('pending', 'countered');
  end if;
  return null;
end
$$;
create trigger jobs_after_close after update of status on public.jobs
  for each row execute function public.jobs_after_close();

-- current_stage_id işin kendi şablonuna ait olmalı
create or replace function public.jobs_check_stage()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if new.current_stage_id is not null and not exists (
    select 1 from public.template_stages s
     where s.id = new.current_stage_id and s.template_id = new.template_id
  ) then
    raise exception 'Aşama bu işin şablonuna ait değil' using errcode = '23514';
  end if;
  return new;
end
$$;
create trigger jobs_check_stage before insert or update of current_stage_id on public.jobs
  for each row execute function public.jobs_check_stage();

-- offer_rounds append-only. Tek istisna: üst teklif (iş/hesap silinmesiyle) silinirken
-- gelen cascade silme; o anda üst satır artık görünmez.
create or replace function public.offer_rounds_append_only()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if tg_op = 'DELETE' and not exists (select 1 from public.offers o where o.id = old.offer_id) then
    return old;
  end if;
  raise exception 'offer_rounds yalnızca eklenebilir' using errcode = '42501';
end
$$;
create trigger offer_rounds_no_update before update or delete on public.offer_rounds
  for each row execute function public.offer_rounds_append_only();
create trigger offer_rounds_no_truncate before truncate on public.offer_rounds
  for each statement execute function public.offer_rounds_append_only();

-- Müşteri sayfası için içeriksiz Realtime sinyali (veri kanaldan geçmez)
create or replace function public.notify_job_changed()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_row jsonb := to_jsonb(case when tg_op = 'DELETE' then old else new end);
  v_job_id uuid;
  v_token text;
begin
  if tg_table_name = 'jobs' then
    v_job_id := (v_row ->> 'id')::uuid;
  elsif tg_table_name = 'offer_rounds' then
    select o.job_id into v_job_id from public.offers o where o.id = (v_row ->> 'offer_id')::uuid;
  else
    v_job_id := (v_row ->> 'job_id')::uuid;
  end if;

  select j.tracking_token into v_token from public.jobs j where j.id = v_job_id;
  if v_token is not null then
    perform realtime.send(jsonb_build_object('at', now()), 'changed', public.job_topic(v_token), false);
  end if;
  return null;
end
$$;
create trigger jobs_notify after update on public.jobs
  for each row execute function public.notify_job_changed();
create trigger job_stage_events_notify after insert or delete on public.job_stage_events
  for each row execute function public.notify_job_changed();
create trigger job_media_notify after insert or update or delete on public.job_media
  for each row execute function public.notify_job_changed();
create trigger offers_notify after insert or update on public.offers
  for each row execute function public.notify_job_changed();
create trigger offer_rounds_notify after insert on public.offer_rounds
  for each row execute function public.notify_job_changed();

-- Kayıtta işletmeyi oluştur, seçilen sektörün hazır şablonunu kopyala
-- İç fonksiyon: yetki kontrolü çağırana aittir, istemciye açık değildir
create or replace function public._clone_template(p_template_id uuid, p_business_id uuid)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_new uuid;
begin
  insert into public.process_templates (business_id, name, sector)
  select p_business_id, t.name, t.sector
    from public.process_templates t
   where t.id = p_template_id
     and (t.business_id is null or t.business_id = p_business_id)
  returning id into v_new;

  if v_new is null then
    raise exception 'Şablon bulunamadı' using errcode = 'P0002';
  end if;

  insert into public.template_stages (template_id, name, position, color)
  select v_new, s.name, s.position, s.color
    from public.template_stages s
   where s.template_id = p_template_id;

  return v_new;
end
$$;
revoke execute on function public._clone_template(uuid, uuid) from public, anon, authenticated;

-- E5 "Hazır şablonu kullan": oturumdaki esnafın işletmesine kopyalar
create or replace function public.clone_template(p_template_id uuid)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_business uuid := public.auth_business_id();
begin
  if v_business is null then
    raise exception 'Yetkisiz' using errcode = '42501';
  end if;
  return public._clone_template(p_template_id, v_business);
end
$$;
revoke execute on function public.clone_template(uuid) from public, anon;
grant execute on function public.clone_template(uuid) to authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_business uuid;
  v_sector text := nullif(new.raw_user_meta_data ->> 'sector', '');
  v_template uuid;
  v_phone text := nullif(new.raw_user_meta_data ->> 'phone', '');
begin
  if v_phone is not null and v_phone !~ '^\+[1-9][0-9]{9,14}$' then
    v_phone := null;
  end if;

  insert into public.businesses (owner_id, name, phone)
  values (
    new.id,
    left(coalesce(nullif(trim(new.raw_user_meta_data ->> 'business_name'), ''), 'İşletmem'), 80),
    v_phone
  )
  returning id into v_business;

  if v_sector is not null then
    select t.id into v_template
      from public.process_templates t
     where t.business_id is null and t.sector = v_sector
     order by t.created_at
     limit 1;
    if v_template is not null then
      perform public._clone_template(v_template, v_business);
    end if;
  end if;

  return new;
end
$$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─────────────────────────────────────────────────────────────
-- Yetkiler ve RLS
-- Anon rolü hiçbir tabloya doğrudan erişemez; müşteri işlemleri
-- yalnızca Edge Function'lardan (service_role) geçer.
-- ─────────────────────────────────────────────────────────────
revoke all on all tables in schema public from anon;
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke execute on functions from anon;

alter table public.businesses        enable row level security;
alter table public.process_templates enable row level security;
alter table public.template_stages   enable row level security;
alter table public.jobs              enable row level security;
alter table public.job_stage_events  enable row level security;
alter table public.job_media         enable row level security;
alter table public.offers            enable row level security;
alter table public.offer_rounds      enable row level security;
alter table public.ratings           enable row level security;
alter table public.rate_limits       enable row level security;
-- rate_limits: hiçbir politika yok → yalnızca service_role

-- businesses
create policy businesses_select on public.businesses for select to authenticated
  using (owner_id = (select auth.uid()));
create policy businesses_update on public.businesses for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

-- process_templates: hazır şablonlar okunur, kendi şablonları yönetilir
create policy templates_select on public.process_templates for select to authenticated
  using (business_id is null or business_id = (select public.auth_business_id()));
create policy templates_insert on public.process_templates for insert to authenticated
  with check (business_id = (select public.auth_business_id()));
create policy templates_update on public.process_templates for update to authenticated
  using (business_id = (select public.auth_business_id()))
  with check (business_id = (select public.auth_business_id()));
create policy templates_delete on public.process_templates for delete to authenticated
  using (business_id = (select public.auth_business_id()));

-- template_stages
create policy stages_select on public.template_stages for select to authenticated
  using (exists (
    select 1 from public.process_templates t
     where t.id = template_id
       and (t.business_id is null or t.business_id = (select public.auth_business_id()))
  ));
create policy stages_insert on public.template_stages for insert to authenticated
  with check (exists (
    select 1 from public.process_templates t
     where t.id = template_id and t.business_id = (select public.auth_business_id())
  ));
create policy stages_update on public.template_stages for update to authenticated
  using (exists (
    select 1 from public.process_templates t
     where t.id = template_id and t.business_id = (select public.auth_business_id())
  ))
  with check (exists (
    select 1 from public.process_templates t
     where t.id = template_id and t.business_id = (select public.auth_business_id())
  ));
create policy stages_delete on public.template_stages for delete to authenticated
  using (exists (
    select 1 from public.process_templates t
     where t.id = template_id and t.business_id = (select public.auth_business_id())
  ));

-- jobs: ekleme yalnızca job-create Edge Function'ından (kod/token sunucuda üretilir)
create policy jobs_select on public.jobs for select to authenticated
  using (business_id = (select public.auth_business_id()));
create policy jobs_update on public.jobs for update to authenticated
  using (business_id = (select public.auth_business_id()))
  with check (business_id = (select public.auth_business_id()));

-- job_stage_events
create policy events_select on public.job_stage_events for select to authenticated
  using (exists (select 1 from public.jobs j where j.id = job_id and j.business_id = (select public.auth_business_id())));
create policy events_insert on public.job_stage_events for insert to authenticated
  with check (exists (select 1 from public.jobs j where j.id = job_id and j.business_id = (select public.auth_business_id())));
create policy events_delete on public.job_stage_events for delete to authenticated
  using (exists (select 1 from public.jobs j where j.id = job_id and j.business_id = (select public.auth_business_id())));

-- job_media: ekleme media-upload Edge Function'ından (EXIF temizliği sunucuda)
create policy media_select on public.job_media for select to authenticated
  using (exists (select 1 from public.jobs j where j.id = job_id and j.business_id = (select public.auth_business_id())));
create policy media_update on public.job_media for update to authenticated
  using (exists (select 1 from public.jobs j where j.id = job_id and j.business_id = (select public.auth_business_id())))
  with check (exists (select 1 from public.jobs j where j.id = job_id and j.business_id = (select public.auth_business_id())));
create policy media_delete on public.job_media for delete to authenticated
  using (exists (select 1 from public.jobs j where j.id = job_id and j.business_id = (select public.auth_business_id())));

-- offers / offer_rounds: yazma yalnızca offer-action Edge Function'ından (durum makinesi)
create policy offers_select on public.offers for select to authenticated
  using (exists (select 1 from public.jobs j where j.id = job_id and j.business_id = (select public.auth_business_id())));
create policy rounds_select on public.offer_rounds for select to authenticated
  using (exists (
    select 1 from public.offers o join public.jobs j on j.id = o.job_id
     where o.id = offer_id and j.business_id = (select public.auth_business_id())
  ));

-- ratings: esnaf okur, müşteri Edge Function'la yazar
create policy ratings_select on public.ratings for select to authenticated
  using (exists (select 1 from public.jobs j where j.id = job_id and j.business_id = (select public.auth_business_id())));

-- ─────────────────────────────────────────────────────────────
-- Storage
-- ─────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('job-media', 'job-media', false, 5242880, array['image/jpeg', 'image/png', 'image/webp']),
  ('logos',     'logos',     true,  2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- job-media: yol = <business_id>/<job_id>/<uuid>.<ext>; esnaf yalnızca okur/siler (signed URL için)
create policy job_media_owner_read on storage.objects for select to authenticated
  using (bucket_id = 'job-media' and (storage.foldername(name))[1] = (select public.auth_business_id())::text);
create policy job_media_owner_delete on storage.objects for delete to authenticated
  using (bucket_id = 'job-media' and (storage.foldername(name))[1] = (select public.auth_business_id())::text);

-- logos: yol = <business_id>/<dosya>
create policy logos_owner_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'logos' and (storage.foldername(name))[1] = (select public.auth_business_id())::text);
create policy logos_owner_update on storage.objects for update to authenticated
  using (bucket_id = 'logos' and (storage.foldername(name))[1] = (select public.auth_business_id())::text);
create policy logos_owner_delete on storage.objects for delete to authenticated
  using (bucket_id = 'logos' and (storage.foldername(name))[1] = (select public.auth_business_id())::text);
