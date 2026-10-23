-- Hosted Supabase's "automatic RLS" option adds public.rls_auto_enable(), an
-- event trigger function, callable over the API by anon and authenticated.
-- It can't run outside a DDL event, but nobody should call it through the API.
-- The event trigger itself keeps working (it isn't invoked through these roles).
-- Local databases don't have the function, so this only acts when it exists.
do $$
begin
  if exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'rls_auto_enable'
  ) then
    revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
  end if;
end;
$$;
