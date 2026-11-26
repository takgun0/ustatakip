-- UstaTakip · Hazır şablonlar (business_id NULL = herkese açık)
-- Tekrar çalıştırılabilir: aynı sektörde hazır şablon varsa atlanır.

do $$
declare
  v_tpl uuid;
  r record;
begin
  for r in
    select * from (values
      ('Oto Tamir',  'Oto Tamir Standart',  array['Teslim Alındı','Arıza Tespiti','Parça Bekleniyor','Onarım','Test Sürüşü','Teslime Hazır']),
      ('Oto Yıkama', 'Oto Yıkama Standart', array['Teslim Alındı','Ön Yıkama','Detaylı Dış Temizlik','İç Temizlik','Kurulama ve Cila','Teslime Hazır']),
      ('Mobilya',    'Mobilya Üretim',      array['Sipariş Alındı','Ölçü ve Çizim','Malzeme Tedariki','Üretim','Boya ve Cila','Montaj','Teslime Hazır']),
      ('Terzi',      'Terzi Dikim',         array['Teslim Alındı','Ölçü Alındı','Kesim','Dikim','Prova','Son Rötuş','Teslime Hazır'])
    ) as t(sector, name, stages)
  loop
    if exists (select 1 from public.process_templates where business_id is null and sector = r.sector) then
      continue;
    end if;

    insert into public.process_templates (business_id, name, sector)
    values (null, r.name, r.sector)
    returning id into v_tpl;

    -- Renkler --ut-* paletinden: ilk aşama primary, son aşama success, aradakiler info/accent/warning döngüsü
    insert into public.template_stages (template_id, name, position, color)
    select v_tpl, s.name, s.ord - 1,
           case
             when s.ord = 1 then '#1E3A5F'
             when s.ord = cardinality(r.stages) then '#16A34A'
             else (array['#2563EB', '#F59E0B', '#D97706'])[((s.ord - 2) % 3) + 1]
           end
      from unnest(r.stages) with ordinality as s(name, ord);
  end loop;
end
$$;
