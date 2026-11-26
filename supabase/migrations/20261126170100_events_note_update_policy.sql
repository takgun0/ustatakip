-- Esnaf kendi işlerinin aşama notunu düzenleyebilir; yalnızca "note" sütunu güncellenebilir
create policy events_update on public.job_stage_events for update to authenticated
  using (exists (select 1 from public.jobs j where j.id = job_id and j.business_id = (select public.auth_business_id())))
  with check (exists (select 1 from public.jobs j where j.id = job_id and j.business_id = (select public.auth_business_id())));
revoke update on public.job_stage_events from authenticated;
grant update (note) on public.job_stage_events to authenticated;
