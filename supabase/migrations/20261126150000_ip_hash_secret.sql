-- IP özetleri (rate limit anahtarları, teklif yanıtlarındaki ip_hash) için HMAC anahtarı.
-- Değer repoda durmaz: ilk çalıştırmada veritabanında rastgele üretilip Supabase Vault'ta şifreli saklanır.
-- Edge Function önce IP_HASH_SECRET ortam değişkenine bakar, yoksa bu fonksiyonu çağırır.

do $$
begin
  if not exists (select 1 from vault.secrets where name = 'ip_hash_secret') then
    perform vault.create_secret(
      encode(extensions.gen_random_bytes(32), 'hex'),
      'ip_hash_secret',
      'UstaTakip: IP adreslerini HMAC ile özetlemek için anahtar'
    );
  end if;
end
$$;

create or replace function public.ip_hash_secret()
returns text
language sql stable security definer set search_path = ''
as $$
  select decrypted_secret from vault.decrypted_secrets where name = 'ip_hash_secret' limit 1
$$;
revoke execute on function public.ip_hash_secret() from public, anon, authenticated;
grant execute on function public.ip_hash_secret() to service_role;

-- Süresi çoktan geçmiş rate limit sayaçlarını temizler (Edge Function ara sıra çağırır)
create or replace function public.purge_rate_limits()
returns void
language sql security definer set search_path = ''
as $$
  delete from public.rate_limits where window_start < now() - interval '1 day'
$$;
revoke execute on function public.purge_rate_limits() from public, anon, authenticated;
grant execute on function public.purge_rate_limits() to service_role;
