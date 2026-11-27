-- UstaTakip · Demo verisi: sunum işi (yalnızca demo işletmesi)
-- Sunumda dinleyiciler müşteri takip sayfasını kendi telefonlarından izlesin diye eklenir.
-- Süreç projenin kendisidir: "Proje Ödevi" şablonu, iş şu an "Sunum" aşamasında.
-- Sunum sırasında panelden "Sonraki aşama" denince açık olan tüm takip sayfaları canlı yenilenir.
-- Takip kodu UT-DERS26, telefonun son 4 hanesi 2026. Kişi ve telefon bilgileri uydurmadır.
-- Tekrar çalıştırılabilir: kod zaten varsa atlanır.

do $$
declare
  v_biz     uuid;
  v_now     timestamptz := now();
  v_tpl     uuid;
  v_job     uuid;
  v_stages  uuid[];
  v_created timestamptz := now() - interval '42 days';
  v_names   text[] := array['Konu Seçimi','Araştırma ve Analiz','Tasarım','Geliştirme','Test','Sunum','Değerlendirme'];
  -- Her aşamaya girildiği gün (oluşturmadan itibaren) ve not
  v_days    numeric[] := array[0, 4, 11, 18, 34, 41.98];
  v_notes   text[] := array[
    'Konu belirlendi: küçük esnafın iş süreçlerini müşteriyle paylaşabileceği bir takip uygulaması.',
    'Oto servis, terzi ve tadilat ustalarıyla konuşuldu. Ortak sorun: müşteriler gün içinde defalarca "işim ne durumda?" diye arıyor.',
    'Esnaf paneli ve müşteri takip sayfası tasarlandı. Müşteri uygulama indirmeden, yalnızca bir bağlantıyla takip edebilmeli.',
    'Next.js ve Supabase ile geliştirildi: aşamalar, takip kodu ve QR, fotoğraf, ek iş teklifi ve pazarlık.',
    'Otomatik testler geçti; telefonda, tablette ve bilgisayarda denendi.',
    'Şu an sunumdayız! Bu sayfa canlı: esnaf paneli bir sonraki aşamaya geçtiğinde ekranınız kendiliğinden yenilenir.'
  ];
  i int;
begin
  select id into v_biz from public.businesses where owner_id = 'd0d0d0d0-0000-4000-8000-000000000001';
  if v_biz is null then
    raise notice 'Demo işletmesi yok, atlandı';
    return;
  end if;
  if exists (select 1 from public.jobs where tracking_code = 'UT-DERS26') then
    raise notice 'Sunum işi zaten var';
    return;
  end if;

  -- İşletmeye özel şablon (hazır şablonlar listesinde görünmez)
  select id into v_tpl from public.process_templates where business_id = v_biz and name = 'Proje Ödevi' limit 1;
  if v_tpl is null then
    insert into public.process_templates (business_id, name, sector, created_at)
    values (v_biz, 'Proje Ödevi', 'Proje Ödevi', v_created)
    returning id into v_tpl;
    insert into public.template_stages (template_id, name, position, color)
    select v_tpl, s.name, s.ord - 1,
           case
             when s.ord = 1 then '#1E3A5F'
             when s.ord = cardinality(v_names) then '#16A34A'
             else (array['#2563EB', '#F59E0B', '#D97706'])[((s.ord - 2) % 3) + 1]
           end
      from unnest(v_names) with ordinality as s(name, ord);
  end if;

  select array_agg(id order by position) into v_stages from public.template_stages where template_id = v_tpl;

  insert into public.jobs (business_id, template_id, customer_name, customer_phone, title, item_label, description,
                           agreed_amount, estimated_delivery, current_stage_id, status, tracking_code, tracking_token,
                           created_at, updated_at)
  values (v_biz, v_tpl, 'Proje Değerlendirme Jürisi', '+905300002026',
          'Esnaf Süreç Takip · Proje Ödevi', 'UstaTakip · web uygulaması',
          'Esnafın iş süreçlerini müşterisiyle paylaştığı takip uygulaması. Bu iş, sunumda herkesin müşteri ekranını kendi telefonundan izleyebilmesi için eklendi.',
          null, null, v_stages[6], 'active', 'UT-DERS26',
          rtrim(translate(encode(extensions.gen_random_bytes(32), 'base64'), '+/', '-_'), '='),
          v_created, v_now)
  returning id into v_job;

  for i in 1..6 loop
    insert into public.job_stage_events (job_id, stage_id, note, entered_at)
    values (v_job, v_stages[i], v_notes[i], v_created + make_interval(secs => v_days[i] * 86400));
  end loop;
end
$$;
