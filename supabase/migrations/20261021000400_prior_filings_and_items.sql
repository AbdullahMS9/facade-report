-- Cached prior filings from NYC Open Data, and prior-cycle items entered by hand.

-- One cache row per building. Filled by the app as the signed-in user, so RLS
-- applies like any other table. `lookup_key` records what was queried
-- (e.g. "bin:1012345"); a changed BIN or lot makes the cache stale.
create table public.building_filings_cache (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.firms (id) on delete cascade,
  building_id uuid not null unique,
  lookup_key text not null check (char_length(lookup_key) <= 100),
  filings jsonb not null default '[]'::jsonb check (jsonb_typeof(filings) = 'array'),
  fetched_at timestamptz,          -- last successful fetch
  last_attempt_at timestamptz,     -- last try, successful or not
  last_error text check (char_length(last_error) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (building_id, firm_id) references public.buildings (id, firm_id) on delete cascade
);
create index building_filings_cache_firm_id_idx on public.building_filings_cache (firm_id);

-- Conditions from the previous report that required repair (CLAUDE.md §2, §4 item 7).
-- repaired: null = not decided yet; false = carried forward and reported UNSAFE.
create table public.prior_items (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.firms (id) on delete cascade,
  project_id uuid not null,
  description text not null check (char_length(btrim(description)) between 1 and 1000),
  location_note text check (char_length(location_note) <= 300),
  repaired boolean,
  notes text check (char_length(notes) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (project_id, firm_id) references public.projects (id, firm_id) on delete cascade
);
create index prior_items_project_id_idx on public.prior_items (project_id);

create trigger building_filings_cache_updated_at before update on public.building_filings_cache
  for each row execute function private.set_updated_at();
create trigger prior_items_updated_at before update on public.prior_items
  for each row execute function private.set_updated_at();

alter table public.building_filings_cache enable row level security;
alter table public.prior_items enable row level security;
revoke all on public.building_filings_cache, public.prior_items from anon;

create policy "Members can read filings cache" on public.building_filings_cache
  for select to authenticated using (private.is_firm_member(firm_id));
create policy "Members can add filings cache" on public.building_filings_cache
  for insert to authenticated with check (private.is_firm_member(firm_id));
create policy "Members can refresh filings cache" on public.building_filings_cache
  for update to authenticated
  using (private.is_firm_member(firm_id)) with check (private.is_firm_member(firm_id));

create policy "Members can read prior items" on public.prior_items
  for select to authenticated using (private.is_firm_member(firm_id));
create policy "Members can add prior items" on public.prior_items
  for insert to authenticated with check (private.is_firm_member(firm_id));
create policy "Members can edit prior items" on public.prior_items
  for update to authenticated
  using (private.is_firm_member(firm_id)) with check (private.is_firm_member(firm_id));
create policy "QEWI can delete prior items" on public.prior_items
  for delete to authenticated using (private.is_firm_qewi(firm_id));
