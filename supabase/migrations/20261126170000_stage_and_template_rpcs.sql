-- Faz 4: aşama ilerletme ve süreç şablonu düzenleme.
-- Tüm fonksiyonlar SECURITY INVOKER: RLS çağıran esnafın kimliğiyle geçerlidir,
-- fonksiyonlar yalnızca birden çok yazmayı tek işlemde (atomik) yapar.

-- Olay kaydındaki aşama işin kendi şablonuna ait olmalı (doğrudan insert'lerde de)
create or replace function public.job_events_check_stage()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.jobs j
      join public.template_stages s on s.template_id = j.template_id
     where j.id = new.job_id and s.id = new.stage_id
  ) then
    raise exception 'Aşama bu işin şablonuna ait değil' using errcode = '23514';
  end if;
  return new;
end
$$;
revoke execute on function public.job_events_check_stage() from public, anon, authenticated;
create trigger job_stage_events_check before insert on public.job_stage_events
  for each row execute function public.job_events_check_stage();

-- Aktif aşamanın notunu kaydeder (müşteri görür)
create or replace function public.set_stage_note(p_job_id uuid, p_note text)
returns void
language plpgsql security invoker set search_path = ''
as $$
declare
  v_job public.jobs;
begin
  select * into v_job from public.jobs where id = p_job_id for update;
  if not found then raise exception 'İş bulunamadı' using errcode = 'P0002'; end if;
  if char_length(coalesce(p_note, '')) > 1000 then raise exception 'Not en fazla 1000 karakter olabilir' using errcode = '22001'; end if;
  update public.job_stage_events e set note = nullif(btrim(p_note), '')
   where e.id = (
     select id from public.job_stage_events
      where job_id = p_job_id and stage_id = v_job.current_stage_id
      order by entered_at desc limit 1
   );
end
$$;

-- Tek dokunuşla ilerletme: aktif aşamanın notunu kaydeder, sonraki aşamaya geçer;
-- son aşamadaysa işi "teslim edildi" yapar (token 30 gün sonra kapanır).
create or replace function public.advance_job(p_job_id uuid, p_note text default null)
returns jsonb
language plpgsql security invoker set search_path = ''
as $$
declare
  v_job public.jobs;
  v_pos integer;
  v_next uuid;
begin
  select * into v_job from public.jobs where id = p_job_id for update;
  if not found then raise exception 'İş bulunamadı' using errcode = 'P0002'; end if;
  if v_job.status <> 'active' then raise exception 'Bu iş kapanmış' using errcode = 'P0001'; end if;

  if p_note is not null then perform public.set_stage_note(p_job_id, p_note); end if;

  select position into v_pos from public.template_stages where id = v_job.current_stage_id;
  select id into v_next from public.template_stages
   where template_id = v_job.template_id and position > coalesce(v_pos, -1)
   order by position limit 1;

  if v_next is null then
    update public.jobs set status = 'delivered' where id = p_job_id;
    return jsonb_build_object('status', 'delivered', 'stage_id', v_job.current_stage_id);
  end if;

  insert into public.job_stage_events (job_id, stage_id) values (p_job_id, v_next);
  update public.jobs set current_stage_id = v_next where id = p_job_id;
  return jsonb_build_object('status', 'active', 'stage_id', v_next);
end
$$;

-- "Son ilerletmeyi geri al": teslimi geri alır ya da son aşama kaydını silip öncekine döner
create or replace function public.undo_job_stage(p_job_id uuid)
returns jsonb
language plpgsql security invoker set search_path = ''
as $$
declare
  v_job public.jobs;
  v_last uuid;
  v_prev_stage uuid;
begin
  select * into v_job from public.jobs where id = p_job_id for update;
  if not found then raise exception 'İş bulunamadı' using errcode = 'P0002'; end if;

  if v_job.status = 'delivered' then
    update public.jobs set status = 'active' where id = p_job_id;
    return jsonb_build_object('status', 'active', 'stage_id', v_job.current_stage_id);
  end if;
  if v_job.status <> 'active' then raise exception 'Bu iş kapanmış' using errcode = 'P0001'; end if;

  select id into v_last from public.job_stage_events where job_id = p_job_id order by entered_at desc limit 1;
  select stage_id into v_prev_stage from public.job_stage_events
   where job_id = p_job_id and id <> v_last order by entered_at desc limit 1;
  if v_prev_stage is null then raise exception 'Geri alınacak ilerletme yok' using errcode = 'P0001'; end if;

  update public.jobs set current_stage_id = v_prev_stage where id = p_job_id;
  delete from public.job_stage_events where id = v_last;
  return jsonb_build_object('status', 'active', 'stage_id', v_prev_stage);
end
$$;

-- Şablonu tek seferde kaydeder: ad + sıralı aşama listesi [{id?, name, color}].
-- Listede olmayan aşamalar silinir; iş kaydında geçen aşama silinemez.
create or replace function public.save_template(p_template_id uuid, p_name text, p_stages jsonb)
returns void
language plpgsql security invoker set search_path = ''
as $$
declare
  v_ids uuid[];
  v_stage jsonb;
  v_i integer := 0;
begin
  if not exists (select 1 from public.process_templates where id = p_template_id and business_id is not null) then
    raise exception 'Şablon bulunamadı' using errcode = 'P0002';
  end if;
  if jsonb_typeof(p_stages) <> 'array' or jsonb_array_length(p_stages) not between 2 and 12 then
    raise exception 'Şablonda 2 ile 12 arasında aşama olmalı' using errcode = '22023';
  end if;
  if char_length(btrim(coalesce(p_name, ''))) not between 2 and 60 then
    raise exception 'Şablon adı 2–60 karakter olmalı' using errcode = '22023';
  end if;

  update public.process_templates set name = btrim(p_name) where id = p_template_id;
  if not found then raise exception 'Şablon bulunamadı' using errcode = 'P0002'; end if;

  set constraints public.template_stages_position_key deferred;

  select array_agg((x ->> 'id')::uuid) into v_ids
    from jsonb_array_elements(p_stages) x where x ->> 'id' is not null;

  begin
    delete from public.template_stages
     where template_id = p_template_id and id <> all (coalesce(v_ids, '{}'));
  exception when foreign_key_violation then
    raise exception 'İş kaydında geçen bir aşama silinemez. Adını değiştirebilir ya da sırasını taşıyabilirsiniz.' using errcode = '23503';
  end;

  for v_stage in select value from jsonb_array_elements(p_stages) loop
    if v_stage ->> 'id' is null then
      insert into public.template_stages (template_id, name, position, color)
      values (p_template_id, btrim(v_stage ->> 'name'), v_i, v_stage ->> 'color');
    else
      update public.template_stages
         set name = btrim(v_stage ->> 'name'), color = v_stage ->> 'color', position = v_i
       where id = (v_stage ->> 'id')::uuid and template_id = p_template_id;
      if not found then raise exception 'Aşama bu şablona ait değil' using errcode = '23514'; end if;
    end if;
    v_i := v_i + 1;
  end loop;
end
$$;

-- Yeni boş/özel şablon
create or replace function public.create_template(p_name text, p_stages jsonb)
returns uuid
language plpgsql security invoker set search_path = ''
as $$
declare
  v_id uuid;
begin
  insert into public.process_templates (business_id, name, sector)
  values (public.auth_business_id(), btrim(p_name), 'Özel')
  returning id into v_id;
  perform public.save_template(v_id, p_name, p_stages);
  return v_id;
end
$$;

revoke execute on function public.set_stage_note(uuid, text) from public, anon;
revoke execute on function public.advance_job(uuid, text) from public, anon;
revoke execute on function public.undo_job_stage(uuid) from public, anon;
revoke execute on function public.save_template(uuid, text, jsonb) from public, anon;
revoke execute on function public.create_template(text, jsonb) from public, anon;
grant execute on function public.set_stage_note(uuid, text) to authenticated;
grant execute on function public.advance_job(uuid, text) to authenticated;
grant execute on function public.undo_job_stage(uuid) to authenticated;
grant execute on function public.save_template(uuid, text, jsonb) to authenticated;
grant execute on function public.create_template(text, jsonb) to authenticated;
