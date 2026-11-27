-- UstaTakip · Demo verisi: hedef sektörlerden örnek işler (yalnızca demo işletmesi)
-- Demo işletmesi "Yıldız Oto Servis" (sahibi d0d0d0d0-0000-4000-8000-000000000001).
-- Her sektörün hazır şablonu (seed.sql) işletmeye kopyalanır, ardından 1–2 örnek iş eklenir:
-- farklı aşamalarda aktif işler, teslim edilmiş işler, bekleyen / karşı teklifli / kabul edilmiş teklifler.
-- Tekrar çalıştırılabilir: aynı başlıklı iş varsa atlanır. Kişi, telefon ve plaka bilgileri uydurmadır.

do $$
declare
  v_biz   uuid;
  v_now   timestamptz := now();
  j       jsonb;
  v_tpl   uuid;
  v_job   uuid;
  v_offer uuid;
  v_code  text;
  v_token text;
  v_stages uuid[];
  v_stage_count int;
  v_idx   int;
  v_created timestamptz;
  v_end   timestamptz;
  v_note  text;
  r       jsonb;
  i       int;
  alphabet constant text := '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
begin
  select id into v_biz from public.businesses where owner_id = 'd0d0d0d0-0000-4000-8000-000000000001';
  if v_biz is null then
    raise notice 'Demo işletmesi yok, atlandı';
    return;
  end if;

  for j in select * from jsonb_array_elements($json$[
    {"sector":"Kaporta ve Boya","title":"Sol ön çamurluk ve kapı boyası","item":"2019 Fiat Egea · 34 KBY 482","customer":"Burak Şen","phone":"+905300000101",
     "desc":"Otoparkta sürtme. Çamurluk düzeltilip sol ön kapıyla birlikte boyanacak.","agreed":1250000,"stage":4,"status":"active","created":4.2,"due":1,
     "notes":["Araç 54.300 km'de teslim alındı, hasar fotoğraflandı.","Çamurluk ve kapıda boya gerekiyor; tampon sağlam.","Çamurluk düzeltildi, macun atıldı.","Zımpara ve astar tamamlandı.","Boya kabininde; renk kodu fabrika çıkışıyla eşleştirildi."]},
    {"sector":"Kaporta ve Boya","title":"Arka tampon göçüğü","item":"2021 Toyota Corolla · 06 TKR 915","customer":"Deniz Aksoy","phone":"+905300000102",
     "desc":"Geri manevrada direğe çarpma.","agreed":650000,"stage":1,"status":"active","created":0.8,"due":3,
     "notes":["Teslim alındı.","Tampon içindeki park sensörü kırık, değişmesi gerekiyor."],
     "offer":{"title":"Park sensörü değişimi","desc":"Orijinal sensör, boyalı olarak takılır.","status":"pending","current":180000,
              "rounds":[{"round":1,"actor":"business","action":"propose","amount":180000,"note":"Orijinal parça, 1 adet","h":2}]}},

    {"sector":"Mobilya","title":"Koltuk takımı döşeme yenileme","item":"3+2+1 koltuk takımı · kadife kumaş","customer":"Selin Yurt","phone":"+905300000103",
     "desc":"Süngerler yenilenecek, kumaş müşteri seçimi: zeytin yeşili kadife.","agreed":2400000,"stage":3,"status":"active","created":9,"due":4,
     "notes":["Koltuklar atölyeye alındı.","Ölçüler alındı, kumaş metrajı 18 m.","Kumaş siparişi geldi.","Eski döşemeler söküldü, iskelet sağlam; yeni süngerler yerleştiriliyor."]},
    {"sector":"Mobilya","title":"Mutfak dolabı kapakları","item":"12 kapak · lake beyaz","customer":"Hakan Doğru","phone":"+905300000104",
     "desc":"Üst ve alt dolap kapakları yenilendi, menteşeler frenli.","agreed":3850000,"stage":6,"status":"delivered","created":16,"delivered":2.5,
     "notes":["Sipariş alındı.","Yerinde ölçü alındı.",null,"Kapaklar CNC'de kesildi.","Lake boya iki kat atıldı.","Montaj tamamlandı, ayarlar yapıldı.","Teslim edildi."]},

    {"sector":"Elektronik Tamiri","title":"Laptop ekran değişimi","item":"Lenovo IdeaPad 5 · 15,6\"","customer":"Ece Tunç","phone":"+905300000105",
     "desc":"Ekranda çizgiler ve titreme var.","agreed":540000,"stage":2,"status":"active","created":3,"due":2,
     "notes":["Cihaz şarj aletiyle birlikte alındı.","Panel arızalı; ayrıca klavyede iki tuş çalışmıyor.","Ekran paneli sipariş edildi, yarın gelmesi bekleniyor."],
     "offer":{"title":"Klavye değişimi","desc":"Türkçe Q klavye, aydınlatmalı.","status":"accepted","current":120000,"final":120000,
              "rounds":[{"round":1,"actor":"business","action":"propose","amount":150000,"note":null,"h":50},
                        {"round":1,"actor":"customer","action":"counter","amount":120000,"note":"Aydınlatmasız olsa da olur","h":46},
                        {"round":1,"actor":"business","action":"accept","amount":null,"note":null,"h":45}]}},
    {"sector":"Elektronik Tamiri","title":"Telefon şarj soketi","item":"iPhone 12 · siyah","customer":"Mert Kalkan","phone":"+905300000106",
     "desc":"Şarj kablosu temassızlık yapıyor.","agreed":95000,"stage":5,"status":"active","created":1.6,"due":0.2,
     "notes":["Cihaz alındı, ekran kilidi müşteride.","Soket içinde oksitlenme var.",null,"Soket değiştirildi.","Hızlı şarj ve veri aktarımı test edildi.","Hazır, mesai bitimine kadar teslim alınabilir."]},

    {"sector":"Tadilat ve Tesisat","title":"Banyo tadilatı","item":"Kadıköy · 6 m² banyo","customer":"Nihan Erdem","phone":"+905300000107",
     "desc":"Fayans, vitrifiye ve tesisat yenileme. Duşakabin dahil.","agreed":6500000,"stage":3,"status":"active","created":12,"due":5,
     "notes":["Keşif yapıldı, ölçüler alındı.","Seramik ve vitrifiye siparişleri verildi.","Eski fayanslar ve tesisat söküldü.","Su yalıtımı bitti, duvar seramikleri döşeniyor."],
     "offer":{"title":"Gömme rezervuar","desc":"Duvar asma klozet için gömme rezervuar ve tuş takımı.","status":"countered","current":600000,
              "rounds":[{"round":1,"actor":"business","action":"propose","amount":750000,"note":"Malzeme ve işçilik dahil","h":20},
                        {"round":1,"actor":"customer","action":"counter","amount":600000,"note":"Tuş takımını ben alırsam olur mu?","h":6}]}},
    {"sector":"Tadilat ve Tesisat","title":"Kombi bakımı ve petek temizliği","item":"3+1 daire · 8 petek","customer":"Okan Polat","phone":"+905300000108",
     "desc":"Yıllık kombi bakımı, peteklerde ilaçlı temizlik.","agreed":280000,"stage":5,"status":"delivered","created":6,"delivered":4.5,
     "notes":["Keşif: kombi 7 yaşında, basınç düşük.","Temizlik ilacı ve conta alındı.",null,"Petekler ilaçla yıkandı, kombi bakımı yapıldı.","Basınç 1,5 bar, kaçak yok.","Teslim edildi."]},

    {"sector":"Terzi","title":"Takım elbise dikimi","item":"Lacivert yün · 2 parça","customer":"Emre Karaca","phone":"+905300000109",
     "desc":"Düğün için ölçüye özel takım, çift yırtmaç.","agreed":1150000,"stage":4,"status":"active","created":10,"due":3,
     "notes":["Kumaş teslim alındı.","Ölçüler alındı.","Kesim yapıldı.","Ceket ve pantolon dikildi.","İlk prova cumartesi 14:00."]},

    {"sector":"Ayakkabı Tamiri","title":"Bot taban değişimi","item":"Deri bot · 42 numara","customer":"Gizem Yalçın","phone":"+905300000110",
     "desc":"Kauçuk taban aşınmış, topuk açılmış.","agreed":85000,"stage":2,"status":"active","created":2,"due":2,
     "notes":["Teslim alındı.","Taban tamamen değişecek, deri sağlam.","Eski taban söküldü, yeni Vibram taban yapıştırılıyor."]}
  ]$json$::jsonb)
  loop
    if exists (select 1 from public.jobs where business_id = v_biz and title = j->>'title') then
      continue;
    end if;

    -- İşletmede bu sektörün şablonu yoksa hazır şablondan kopyala
    select id into v_tpl from public.process_templates
     where business_id = v_biz and sector = j->>'sector' order by created_at limit 1;
    if v_tpl is null then
      select public._clone_template(t.id, v_biz) into v_tpl
        from public.process_templates t where t.business_id is null and t.sector = j->>'sector';
    end if;

    select array_agg(id order by position) into v_stages from public.template_stages where template_id = v_tpl;
    v_stage_count := cardinality(v_stages);
    v_idx := least((j->>'stage')::int, v_stage_count - 1);

    -- Takip kodu (karışan harfler yok) ve 256 bit token
    loop
      v_code := 'UT-';
      for i in 1..6 loop
        v_code := v_code || substr(alphabet, 1 + (get_byte(extensions.gen_random_bytes(1), 0) % 32), 1);
      end loop;
      exit when not exists (select 1 from public.jobs where tracking_code = v_code);
    end loop;
    v_token := rtrim(translate(encode(extensions.gen_random_bytes(32), 'base64'), '+/', '-_'), '=');

    v_created := v_now - make_interval(secs => (j->>'created')::numeric * 86400);
    v_end := case when j->>'status' = 'delivered'
                  then v_now - make_interval(secs => (j->>'delivered')::numeric * 86400)
                  else v_now - interval '35 minutes' end;

    insert into public.jobs (business_id, template_id, customer_name, customer_phone, title, item_label, description,
                             agreed_amount, estimated_delivery, current_stage_id, status, tracking_code, tracking_token,
                             token_expires_at, created_at, updated_at, delivered_at)
    values (v_biz, v_tpl, j->>'customer', j->>'phone', j->>'title', j->>'item', j->>'desc',
            (j->>'agreed')::bigint,
            case when j ? 'due' then date_trunc('hour', v_now + make_interval(secs => (j->>'due')::numeric * 86400)) end,
            v_stages[v_idx + 1], (j->>'status')::public.job_status, v_code, v_token,
            case when j->>'status' = 'delivered' then v_end + interval '30 days' end,
            v_created, v_end,
            case when j->>'status' = 'delivered' then v_end end)
    returning id into v_job;

    -- Aşama geçmişi: oluşturma ile son güncelleme arasına yayılır
    for i in 0..v_idx loop
      v_note := j->'notes'->>i;
      insert into public.job_stage_events (job_id, stage_id, note, entered_at)
      values (v_job, v_stages[i + 1], v_note,
              case when i = 0 then v_created
                   else v_created + (v_end - v_created) * (i::numeric / (v_idx + 0.5)) end);
    end loop;

    -- Teklif ve pazarlık turları
    if j ? 'offer' then
      insert into public.offers (job_id, title, description, status, current_amount, final_amount, created_at)
      values (v_job, j->'offer'->>'title', j->'offer'->>'desc', (j->'offer'->>'status')::public.offer_status,
              (j->'offer'->>'current')::bigint, (j->'offer'->>'final')::bigint,
              v_now - make_interval(hours => (j->'offer'->'rounds'->0->>'h')::int))
      returning id into v_offer;
      for r in select * from jsonb_array_elements(j->'offer'->'rounds') loop
        insert into public.offer_rounds (offer_id, round_no, actor, action, amount, note, created_at)
        values (v_offer, (r->>'round')::smallint, (r->>'actor')::public.offer_actor, (r->>'action')::public.offer_action,
                (r->>'amount')::bigint, r->>'note', v_now - make_interval(hours => (r->>'h')::int));
      end loop;
    end if;
  end loop;
end
$$;
