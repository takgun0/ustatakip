-- Faz 6: E6 analiz görünümleri.
-- security_invoker = true: görünümler çağıran esnafın yetkisiyle çalışır, alttaki tabloların RLS'i geçerlidir
-- (her esnaf yalnızca kendi işletmesinin satırlarını görür). anon erişimi kapalıdır.

-- Her aşama kaydının süresi. Aşamadan çıkış = aynı işin bir sonraki aşama kaydı; son kayıtta
-- teslim zamanı (teslim edildiyse), iptalde son güncelleme; aktif işin son kaydı açıktır (is_open, süre şimdiye kadar).
create or replace view public.analytics_stage_durations
with (security_invoker = true) as
with ev as (
  select
    e.id,
    e.job_id,
    e.stage_id,
    e.entered_at,
    lead(e.entered_at) over (partition by e.job_id order by e.entered_at, e.id) as next_at
  from public.job_stage_events e
)
select
  ev.id                  as event_id,
  ev.job_id,
  j.business_id,
  j.template_id,
  j.status               as job_status,
  ev.stage_id,
  s.name                 as stage_name,
  s.position             as stage_position,
  s.color                as stage_color,
  ev.entered_at,
  x.left_at,
  x.left_at is null      as is_open,
  greatest(0, extract(epoch from (coalesce(x.left_at, now()) - ev.entered_at)))::bigint as seconds
from ev
join public.jobs j on j.id = ev.job_id
join public.template_stages s on s.id = ev.stage_id
cross join lateral (
  select case
    when ev.next_at is not null then ev.next_at
    when j.status = 'delivered' then j.delivered_at
    when j.status = 'cancelled' then j.updated_at
  end as left_at
) x;

-- Şablon aşaması başına özet (tüm zamanlar). "Kaybedilen süre": her ziyarette medyanın üstünde
-- geçen sürelerin toplamı — darboğaz aşamayı gösterir. Dönem filtresi istemcide (src/lib/analytics.ts).
create or replace view public.analytics_stage_stats
with (security_invoker = true) as
with d as (
  select * from public.analytics_stage_durations
),
m as (
  select stage_id, percentile_cont(0.5) within group (order by seconds) as median_seconds
  from d
  where not is_open
  group by stage_id
)
select
  d.business_id,
  d.template_id,
  d.stage_id,
  d.stage_name,
  d.stage_position,
  d.stage_color,
  count(*)                                                     as visits,
  count(*) filter (where d.is_open)                            as open_now,
  round(avg(d.seconds) filter (where not d.is_open))::bigint   as avg_seconds,
  round(m.median_seconds)::bigint                              as median_seconds,
  max(d.seconds)                                               as max_seconds,
  sum(d.seconds)::bigint                                       as total_seconds,
  coalesce(sum(greatest(0, d.seconds - m.median_seconds)), 0)::bigint as lost_seconds
from d
left join m on m.stage_id = d.stage_id
group by d.business_id, d.template_id, d.stage_id, d.stage_name, d.stage_position, d.stage_color, m.median_seconds;

-- İşletme özeti: iş sayıları, ortalama teslim süresi, puan, ek masraf teklifleri
create or replace view public.analytics_business_summary
with (security_invoker = true) as
select
  b.id as business_id,
  (select count(*) from public.jobs j where j.business_id = b.id and j.status = 'active')    as active_jobs,
  (select count(*) from public.jobs j where j.business_id = b.id and j.status = 'delivered') as delivered_jobs,
  (select round(avg(extract(epoch from (j.delivered_at - j.created_at))))::bigint
     from public.jobs j where j.business_id = b.id and j.status = 'delivered' and j.delivered_at is not null) as avg_cycle_seconds,
  (select round(avg(r.score)::numeric, 2) from public.ratings r join public.jobs j on j.id = r.job_id where j.business_id = b.id) as avg_rating,
  (select count(*) from public.ratings r join public.jobs j on j.id = r.job_id where j.business_id = b.id) as rating_count,
  (select count(*) from public.offers o join public.jobs j on j.id = o.job_id where j.business_id = b.id) as offers_total,
  (select count(*) from public.offers o join public.jobs j on j.id = o.job_id where j.business_id = b.id and o.status = 'accepted') as offers_accepted,
  (select count(*) from public.offers o join public.jobs j on j.id = o.job_id where j.business_id = b.id and o.status = 'rejected') as offers_rejected,
  (select coalesce(sum(o.final_amount), 0)::bigint from public.offers o join public.jobs j on j.id = o.job_id
     where j.business_id = b.id and o.status = 'accepted') as offers_accepted_amount
from public.businesses b;

revoke all on public.analytics_stage_durations, public.analytics_stage_stats, public.analytics_business_summary from anon, public;
grant select on public.analytics_stage_durations, public.analytics_stage_stats, public.analytics_business_summary to authenticated;
