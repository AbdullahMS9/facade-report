-- Buildings, projects, elevations, close-ups (drops) and probes, with RLS.
--
-- Access model:
--   * Any member of the firm can read, add and edit these rows (field staff
--     do most of the data entry).
--   * Only the firm's QEWI can delete rows or change a project's status.
--   * Child rows reference their parent by (id, firm_id), so a row can never
--     point at another firm's parent even if someone guesses its id.

create type public.borough as enum ('manhattan', 'bronx', 'brooklyn', 'queens', 'staten_island');
create type public.report_type as enum ('initial', 'subsequent', 'amended');
create type public.project_status as enum ('draft', 'ready', 'filed');
create type public.closeup_method as enum ('scaffold', 'swing_stage', 'boom_lift', 'rope');

-- Lets projects reference an inspector together with its firm.
alter table public.inspectors add constraint inspectors_id_firm_id_key unique (id, firm_id);

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.buildings (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.firms (id) on delete cascade,

  -- Identifiers (CLAUDE.md §3.5 item 2)
  address text not null check (char_length(btrim(address)) between 1 and 300),
  borough public.borough not null,
  block integer check (block between 1 and 99999),
  lot integer check (lot between 1 and 9999),
  -- Building Identification Number: 7 digits, first digit is the borough code.
  bin text check (bin ~ '^[1-5][0-9]{6}$'),
  cross_street text check (char_length(cross_street) <= 200),
  is_landmark boolean, -- null = not answered yet

  -- Description (§3.5 item 4)
  stories integer check (stories between 1 and 300),
  height_ft numeric(7, 2) check (height_ft > 0 and height_ft < 3000),
  year_built integer check (year_built between 1600 and 2100),
  co_number text check (char_length(co_number) <= 50),
  use text check (char_length(use) <= 200),
  materials text[] not null default '{}' check (cardinality(materials) <= 30),
  materials_notes text check (char_length(materials_notes) <= 2000),
  is_cavity_wall boolean, -- null = not answered yet

  -- Owner (§3.5 item 3); principal applies when the owner is an entity.
  owner_name text check (char_length(owner_name) <= 200),
  owner_address text check (char_length(owner_address) <= 500),
  owner_phone text check (char_length(owner_phone) <= 50),
  owner_principal_name text check (char_length(owner_principal_name) <= 200),
  owner_principal_title text check (char_length(owner_principal_title) <= 200),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, firm_id)
);
create index buildings_firm_id_idx on public.buildings (firm_id);
create unique index buildings_firm_bin_key on public.buildings (firm_id, bin) where bin is not null;

-- One project = one building + one report.
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.firms (id) on delete cascade,
  building_id uuid not null,
  cycle integer not null default 10 check (cycle between 1 and 99),
  report_type public.report_type not null default 'initial',
  qewi_id uuid,
  status public.project_status not null default 'draft',
  exam_start date,
  exam_end date,
  final_visual_date date,      -- QEWI's final walk-around, §103-04(c)(2)(viii)
  closeup_complete_date date,  -- §103-04(c)(4)(ix)
  unsafe_notified_on date,     -- DOB and owner notified, §103-04(c)(2)(vii)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, firm_id),
  check (exam_end is null or exam_start is null or exam_end >= exam_start),
  foreign key (building_id, firm_id) references public.buildings (id, firm_id),
  foreign key (qewi_id, firm_id) references public.inspectors (id, firm_id)
    on delete set null (qewi_id)
);
create index projects_firm_id_idx on public.projects (firm_id);
create index projects_building_id_idx on public.projects (building_id);

create table public.elevations (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.firms (id) on delete cascade,
  project_id uuid not null,
  name text not null check (char_length(btrim(name)) between 1 and 100),
  faces_street boolean not null,
  frontage_ft numeric(8, 2) not null default 0 check (frontage_ft >= 0 and frontage_ft < 10000),
  setbacks_note text check (char_length(setbacks_note) <= 2000),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, firm_id),
  foreign key (project_id, firm_id) references public.projects (id, firm_id) on delete cascade
);
create index elevations_project_id_idx on public.elevations (project_id);

-- A close-up inspection ("drop") along an elevation.
create table public.closeups (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.firms (id) on delete cascade,
  elevation_id uuid not null,
  location_note text not null check (char_length(btrim(location_note)) between 1 and 300),
  inspected_on date not null,
  method public.closeup_method not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, firm_id),
  foreign key (elevation_id, firm_id) references public.elevations (id, firm_id) on delete cascade
);
create index closeups_elevation_id_idx on public.closeups (elevation_id);

-- A cavity wall probe made during a close-up, §103-04(c)(2)(v).
create table public.probes (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.firms (id) on delete cascade,
  closeup_id uuid not null,
  location_note text not null check (char_length(btrim(location_note)) between 1 and 300),
  probed_on date not null,
  tie_type text check (char_length(tie_type) <= 200),
  tie_spacing text check (char_length(tie_spacing) <= 200),
  tie_condition text check (char_length(tie_condition) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (closeup_id, firm_id) references public.closeups (id, firm_id) on delete cascade
);
create index probes_closeup_id_idx on public.probes (closeup_id);

create trigger buildings_updated_at before update on public.buildings
  for each row execute function private.set_updated_at();
create trigger projects_updated_at before update on public.projects
  for each row execute function private.set_updated_at();
create trigger elevations_updated_at before update on public.elevations
  for each row execute function private.set_updated_at();
create trigger closeups_updated_at before update on public.closeups
  for each row execute function private.set_updated_at();
create trigger probes_updated_at before update on public.probes
  for each row execute function private.set_updated_at();

-- Only a QEWI can create a project as, or move it to, ready/filed.
-- Calls without a signed-in user (service role, migrations) are not limited.
create function private.check_project_status_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    return new;
  end if;
  if (tg_op = 'INSERT' and new.status <> 'draft')
     or (tg_op = 'UPDATE' and new.status is distinct from old.status) then
    if not private.is_firm_qewi(new.firm_id) then
      raise exception 'Only a QEWI can change a project''s status.' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

create trigger projects_status_change before insert or update on public.projects
  for each row execute function private.check_project_status_change();

-- ---------------------------------------------------------------------------
-- Row Level Security: members read/add/edit, QEWI deletes.
-- ---------------------------------------------------------------------------

alter table public.buildings enable row level security;
alter table public.projects enable row level security;
alter table public.elevations enable row level security;
alter table public.closeups enable row level security;
alter table public.probes enable row level security;

revoke all on public.buildings, public.projects, public.elevations, public.closeups, public.probes from anon;

create policy "Members can read buildings" on public.buildings
  for select to authenticated using (private.is_firm_member(firm_id));
create policy "Members can add buildings" on public.buildings
  for insert to authenticated with check (private.is_firm_member(firm_id));
create policy "Members can edit buildings" on public.buildings
  for update to authenticated
  using (private.is_firm_member(firm_id)) with check (private.is_firm_member(firm_id));
create policy "QEWI can delete buildings" on public.buildings
  for delete to authenticated using (private.is_firm_qewi(firm_id));

create policy "Members can read projects" on public.projects
  for select to authenticated using (private.is_firm_member(firm_id));
create policy "Members can add projects" on public.projects
  for insert to authenticated with check (private.is_firm_member(firm_id));
create policy "Members can edit projects" on public.projects
  for update to authenticated
  using (private.is_firm_member(firm_id)) with check (private.is_firm_member(firm_id));
create policy "QEWI can delete projects" on public.projects
  for delete to authenticated using (private.is_firm_qewi(firm_id));

create policy "Members can read elevations" on public.elevations
  for select to authenticated using (private.is_firm_member(firm_id));
create policy "Members can add elevations" on public.elevations
  for insert to authenticated with check (private.is_firm_member(firm_id));
create policy "Members can edit elevations" on public.elevations
  for update to authenticated
  using (private.is_firm_member(firm_id)) with check (private.is_firm_member(firm_id));
create policy "QEWI can delete elevations" on public.elevations
  for delete to authenticated using (private.is_firm_qewi(firm_id));

create policy "Members can read close-ups" on public.closeups
  for select to authenticated using (private.is_firm_member(firm_id));
create policy "Members can add close-ups" on public.closeups
  for insert to authenticated with check (private.is_firm_member(firm_id));
create policy "Members can edit close-ups" on public.closeups
  for update to authenticated
  using (private.is_firm_member(firm_id)) with check (private.is_firm_member(firm_id));
create policy "QEWI can delete close-ups" on public.closeups
  for delete to authenticated using (private.is_firm_qewi(firm_id));

create policy "Members can read probes" on public.probes
  for select to authenticated using (private.is_firm_member(firm_id));
create policy "Members can add probes" on public.probes
  for insert to authenticated with check (private.is_firm_member(firm_id));
create policy "Members can edit probes" on public.probes
  for update to authenticated
  using (private.is_firm_member(firm_id)) with check (private.is_firm_member(firm_id));
create policy "QEWI can delete probes" on public.probes
  for delete to authenticated using (private.is_firm_qewi(firm_id));
