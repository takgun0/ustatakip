-- Faz 5: ek masraf teklifleri.
-- Durum makinesi kuralları src/lib/offers.ts'tedir (Edge Function'lar uygular); bu fonksiyonlar yalnızca
-- sonucu tek işlemde ve yarış koşuluna karşı korumalı (beklenen durum/tur eşleşmeli) yazar.
-- Yalnızca service_role çağırabilir: müşteri ve esnaf uçları Edge Function'lardır.

-- offer_rounds append-only kuralı init_schema'daki offer_rounds_append_only tetikleyicisindedir.

-- Yeni teklif (tur 1, esnaf "propose")
create or replace function public.open_offer_tx(
  p_job_id uuid, p_title text, p_description text, p_amount bigint
) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_id uuid;
begin
  perform 1 from public.jobs where id = p_job_id and status = 'active' for update;
  if not found then raise exception 'İş aktif değil' using errcode = 'P0001'; end if;
  if exists (select 1 from public.offers where job_id = p_job_id and status in ('pending', 'countered')) then
    raise exception 'Bu işte yanıt bekleyen bir teklif var' using errcode = 'P0001';
  end if;
  insert into public.offers (job_id, title, description, current_amount)
  values (p_job_id, p_title, p_description, p_amount)
  returning id into v_id;
  insert into public.offer_rounds (offer_id, round_no, actor, action, amount)
  values (v_id, 1, 'business', 'propose', p_amount);
  return v_id;
end
$$;

-- Bir geçişi uygular. p_expected_*: okunan durum; arada başka bir yanıt yazıldıysa 40001 döner.
create or replace function public.apply_offer_round(
  p_offer_id uuid,
  p_expected_status public.offer_status,
  p_expected_round smallint,
  p_status public.offer_status,
  p_amount bigint,
  p_final bigint,
  p_round_no smallint,
  p_actor public.offer_actor,
  p_action public.offer_action,
  p_round_amount bigint,
  p_note text,
  p_ip_hash text
) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_offer public.offers;
  v_round smallint;
begin
  select * into v_offer from public.offers where id = p_offer_id for update;
  if not found then raise exception 'Teklif bulunamadı' using errcode = 'P0002'; end if;
  select coalesce(max(round_no), 1) into v_round from public.offer_rounds where offer_id = p_offer_id;
  if v_offer.status <> p_expected_status or v_round <> p_expected_round then
    raise exception 'Teklif bu arada güncellendi' using errcode = '40001';
  end if;

  update public.offers
     set status = p_status, current_amount = p_amount, final_amount = p_final
   where id = p_offer_id;
  insert into public.offer_rounds (offer_id, round_no, actor, action, amount, note, ip_hash)
  values (p_offer_id, p_round_no, p_actor, p_action, p_round_amount, p_note, p_ip_hash);

  -- Kabul edilen ek masraf iş toplamına eklenir
  if p_status = 'accepted' and p_final is not null then
    update public.jobs set agreed_amount = coalesce(agreed_amount, 0) + p_final where id = v_offer.job_id;
  end if;
end
$$;

revoke execute on function public.open_offer_tx(uuid, text, text, bigint) from public, anon, authenticated;
revoke execute on function public.apply_offer_round(uuid, public.offer_status, smallint, public.offer_status, bigint, bigint, smallint, public.offer_actor, public.offer_action, bigint, text, text) from public, anon, authenticated;
grant execute on function public.open_offer_tx(uuid, text, text, bigint) to service_role;
grant execute on function public.apply_offer_round(uuid, public.offer_status, smallint, public.offer_status, bigint, bigint, smallint, public.offer_actor, public.offer_action, bigint, text, text) to service_role;
