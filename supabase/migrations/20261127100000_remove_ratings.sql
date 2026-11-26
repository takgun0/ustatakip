-- Puanlama özelliği kaldırıldı (M4 puan ekranı, track-rate).
-- analytics_business_summary puan kolonlarına bağlı olduğu için önce görünüm yeniden kurulur,
-- sonra ratings tablosu (politikasıyla birlikte) silinir.

drop view if exists public.analytics_business_summary;

create view public.analytics_business_summary
with (security_invoker = true) as
select
  b.id as business_id,
  (select count(*) from public.jobs j where j.business_id = b.id and j.status = 'active')    as active_jobs,
  (select count(*) from public.jobs j where j.business_id = b.id and j.status = 'delivered') as delivered_jobs,
  (select round(avg(extract(epoch from (j.delivered_at - j.created_at))))::bigint
     from public.jobs j where j.business_id = b.id and j.status = 'delivered' and j.delivered_at is not null) as avg_cycle_seconds,
  (select count(*) from public.offers o join public.jobs j on j.id = o.job_id where j.business_id = b.id) as offers_total,
  (select count(*) from public.offers o join public.jobs j on j.id = o.job_id where j.business_id = b.id and o.status = 'accepted') as offers_accepted,
  (select count(*) from public.offers o join public.jobs j on j.id = o.job_id where j.business_id = b.id and o.status = 'rejected') as offers_rejected,
  (select coalesce(sum(o.final_amount), 0)::bigint from public.offers o join public.jobs j on j.id = o.job_id
     where j.business_id = b.id and o.status = 'accepted') as offers_accepted_amount
from public.businesses b;

revoke all on public.analytics_business_summary from anon, public;
grant select on public.analytics_business_summary to authenticated;

drop table if exists public.ratings;
