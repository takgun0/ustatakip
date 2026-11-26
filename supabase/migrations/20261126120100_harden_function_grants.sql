-- Tetikleyici fonksiyonları RPC olarak çağrılamasın (Supabase güvenlik danışmanı önerisi)
revoke execute on function public.handle_new_user()         from public, anon, authenticated;
revoke execute on function public.jobs_after_close()        from public, anon, authenticated;
revoke execute on function public.notify_job_changed()      from public, anon, authenticated;
revoke execute on function public.jobs_before_update()      from public, anon, authenticated;
revoke execute on function public.jobs_check_stage()        from public, anon, authenticated;
revoke execute on function public.offer_rounds_append_only() from public, anon, authenticated;
revoke execute on function public.job_topic(text)           from public, anon;
grant  execute on function public.job_topic(text)           to authenticated, service_role;
