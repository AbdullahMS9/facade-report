-- Creates a project, and its building if needed, in one transaction.
-- SECURITY INVOKER: runs as the caller, so the normal RLS policies apply.

create function public.create_project(
  p_cycle integer,
  p_report_type public.report_type,
  p_building_id uuid default null,
  p_address text default null,
  p_borough public.borough default null,
  p_block integer default null,
  p_lot integer default null,
  p_bin text default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_firm uuid;
  v_building uuid := p_building_id;
  v_project uuid;
begin
  select firm_id into v_firm from public.memberships where user_id = (select auth.uid());
  if v_firm is null then
    raise exception 'You need to belong to a firm first.' using errcode = '42501';
  end if;

  if v_building is null then
    if p_address is null or p_borough is null then
      raise exception 'Enter the building address and borough.' using errcode = '22023';
    end if;
    insert into public.buildings (firm_id, address, borough, block, lot, bin)
    values (v_firm, p_address, p_borough, p_block, p_lot, p_bin)
    returning id into v_building;
  end if;

  insert into public.projects (firm_id, building_id, cycle, report_type)
  values (v_firm, v_building, p_cycle, p_report_type)
  returning id into v_project;
  return v_project;
end;
$$;

revoke all on function public.create_project(integer, public.report_type, uuid, text, public.borough, integer, integer, text) from public, anon;
grant execute on function public.create_project(integer, public.report_type, uuid, text, public.borough, integer, integer, text) to authenticated;
