-- Observations (conditions found in the field), photos, and the private
-- storage bucket that holds the image files.

create type public.classification as enum ('safe', 'swarmp', 'unsafe');
create type public.photo_kind as enum ('condition', 'elevation', 'inspector', 'probe', 'typical');
create type public.photo_date_source as enum ('exif', 'file');

-- Let children check they belong to the same project / elevation, not just
-- the same firm.
alter table public.elevations add constraint elevations_id_project_id_key unique (id, project_id);
alter table public.closeups add constraint closeups_id_elevation_id_key unique (id, elevation_id);

create table public.observations (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.firms (id) on delete cascade,
  project_id uuid not null,
  elevation_id uuid,
  closeup_id uuid, -- cleared whenever elevation_id is null (trigger below)
  floor text check (char_length(floor) <= 50),
  element text not null check (char_length(btrim(element)) between 1 and 200),
  condition text not null check (char_length(btrim(condition)) between 1 and 2000),
  classification public.classification not null,
  cause text check (char_length(cause) <= 2000),
  notes text check (char_length(notes) <= 4000),
  recommended_repair text check (char_length(recommended_repair) <= 2000),
  repair_by_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, firm_id),
  unique (id, project_id),
  foreign key (project_id, firm_id) references public.projects (id, firm_id) on delete cascade,
  foreign key (elevation_id, project_id) references public.elevations (id, project_id)
    on delete set null (elevation_id),
  foreign key (closeup_id, elevation_id) references public.closeups (id, elevation_id)
    on delete set null (closeup_id)
);
create index observations_project_id_idx on public.observations (project_id);

-- One row per photo. Two files per photo in storage: the untouched original
-- and a display copy (longest side ≤ 2000 px). CLAUDE.md §3.6.
create table public.photos (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.firms (id) on delete cascade,
  project_id uuid not null,
  observation_id uuid,
  kind public.photo_kind not null,
  original_path text not null unique,
  display_path text not null unique,
  original_type text not null check (char_length(original_type) <= 100),
  taken_at timestamptz,
  taken_at_source public.photo_date_source,
  width integer not null check (width > 0),   -- original, upright
  height integer not null check (height > 0),
  caption text check (char_length(caption) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Files live under <firm>/<project>/<photo>/ so storage rules can check the firm.
  check (original_path like firm_id::text || '/' || project_id::text || '/' || id::text || '/%'),
  check (display_path = firm_id::text || '/' || project_id::text || '/' || id::text || '/display.jpg'),
  check (kind <> 'condition' or observation_id is not null),
  foreign key (project_id, firm_id) references public.projects (id, firm_id) on delete cascade,
  foreign key (observation_id, project_id) references public.observations (id, project_id) on delete cascade
);
create index photos_project_id_idx on public.photos (project_id);
create index photos_observation_id_idx on public.photos (observation_id);

-- A drop only makes sense with its elevation. Clearing the elevation (by hand,
-- or when the elevation is deleted) clears the drop too; without this the
-- (closeup_id, elevation_id) link would stop being checked and could dangle.
create function private.observation_drop_needs_elevation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.elevation_id is null then
    new.closeup_id := null;
  end if;
  return new;
end;
$$;

create trigger observations_drop_needs_elevation before insert or update on public.observations
  for each row execute function private.observation_drop_needs_elevation();

create trigger observations_updated_at before update on public.observations
  for each row execute function private.set_updated_at();
create trigger photos_updated_at before update on public.photos
  for each row execute function private.set_updated_at();

alter table public.observations enable row level security;
alter table public.photos enable row level security;
revoke all on public.observations, public.photos from anon;

create policy "Members can read observations" on public.observations
  for select to authenticated using (private.is_firm_member(firm_id));
create policy "Members can add observations" on public.observations
  for insert to authenticated with check (private.is_firm_member(firm_id));
create policy "Members can edit observations" on public.observations
  for update to authenticated
  using (private.is_firm_member(firm_id)) with check (private.is_firm_member(firm_id));
create policy "QEWI can delete observations" on public.observations
  for delete to authenticated using (private.is_firm_qewi(firm_id));

create policy "Members can read photos" on public.photos
  for select to authenticated using (private.is_firm_member(firm_id));
create policy "Members can add photos" on public.photos
  for insert to authenticated with check (private.is_firm_member(firm_id));
create policy "Members can edit photos" on public.photos
  for update to authenticated
  using (private.is_firm_member(firm_id)) with check (private.is_firm_member(firm_id));
create policy "QEWI can delete photos" on public.photos
  for delete to authenticated using (private.is_firm_qewi(firm_id));

-- ---------------------------------------------------------------------------
-- Storage: private bucket; the first folder of every path is the firm id.
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'photos', 'photos', false, 26214400, -- 25 MiB
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
);

-- Firm id from "<firm>/<project>/<photo>/<file>", or null if it isn't a uuid.
create function private.firm_from_path(p_name text)
returns uuid
language sql
immutable
set search_path = ''
as $$
  select case
    when split_part(p_name, '/', 1) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then split_part(p_name, '/', 1)::uuid
  end;
$$;
grant execute on function private.firm_from_path(text) to authenticated;

create policy "Members can view firm photos" on storage.objects
  for select to authenticated
  using (bucket_id = 'photos' and private.is_firm_member(private.firm_from_path(name)));
create policy "Members can upload firm photos" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'photos' and private.is_firm_member(private.firm_from_path(name)));
create policy "QEWI can delete firm photos" on storage.objects
  for delete to authenticated
  using (bucket_id = 'photos' and private.is_firm_qewi(private.firm_from_path(name)));
-- No update policy: files are never overwritten.
