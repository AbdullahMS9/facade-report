-- Firms, memberships, inspectors and invitations, with Row Level Security.
--
-- Access model (CLAUDE.md §4, §6, §8):
--   * A user belongs to at most one firm (memberships.user_id is unique).
--   * Members can read their own firm's rows. Nobody can see another firm.
--   * Only a firm's QEWI can edit the firm, manage inspectors and invite people.
--   * Firms and memberships are never inserted directly; the create_firm and
--     accept_invitation functions do it so the checks can't be skipped.

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

-- Not exposed through the API. Holds helpers used by policies.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create type public.member_role as enum ('qewi', 'staff');
create type public.license_type as enum ('PE', 'RA');

create function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

-- The firm itself; its id is the firm_id every other table points to.
create table public.firms (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.firms (id) on delete cascade,
  -- unique: one firm per user.
  user_id uuid not null unique references auth.users (id) on delete cascade,
  role public.member_role not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index memberships_firm_id_idx on public.memberships (firm_id);

-- Licensed QEWIs who can sign reports for the firm.
create table public.inspectors (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.firms (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  name text not null check (char_length(btrim(name)) between 1 and 200),
  license_type public.license_type not null,
  license_number text not null check (char_length(btrim(license_number)) between 1 and 50),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (firm_id, license_type, license_number)
);
create index inspectors_firm_id_idx on public.inspectors (firm_id);

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.firms (id) on delete cascade,
  email text not null check (email = lower(btrim(email)) and email like '_%@_%'),
  role public.member_role not null default 'staff',
  -- Secret that goes in the invite link.
  token uuid not null unique default gen_random_uuid(),
  invited_by uuid references auth.users (id) on delete set null,
  expires_at timestamptz not null default now() + interval '7 days',
  accepted_at timestamptz,
  accepted_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index invitations_firm_id_idx on public.invitations (firm_id);
-- One open invitation per email per firm.
create unique index invitations_one_open_per_email
  on public.invitations (firm_id, email)
  where accepted_at is null;

create trigger firms_updated_at before update on public.firms
  for each row execute function private.set_updated_at();
create trigger memberships_updated_at before update on public.memberships
  for each row execute function private.set_updated_at();
create trigger inspectors_updated_at before update on public.inspectors
  for each row execute function private.set_updated_at();
create trigger invitations_updated_at before update on public.invitations
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- Policy helpers. SECURITY DEFINER so policies on memberships don't recurse.
-- ---------------------------------------------------------------------------

create function private.is_firm_member(p_firm_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.memberships
    where user_id = (select auth.uid()) and firm_id = p_firm_id
  );
$$;

create function private.is_firm_qewi(p_firm_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.memberships
    where user_id = (select auth.uid()) and firm_id = p_firm_id and role = 'qewi'
  );
$$;

revoke all on function private.is_firm_member(uuid) from public;
revoke all on function private.is_firm_qewi(uuid) from public;
grant execute on function private.is_firm_member(uuid) to authenticated;
grant execute on function private.is_firm_qewi(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.firms enable row level security;
alter table public.memberships enable row level security;
alter table public.inspectors enable row level security;
alter table public.invitations enable row level security;

-- Signed-out visitors get nothing, even if a policy is added by mistake.
revoke all on public.firms, public.memberships, public.inspectors, public.invitations from anon;

-- firms: members read; QEWI renames. No direct insert or delete.
create policy "Members can read their firm" on public.firms
  for select to authenticated
  using (private.is_firm_member(id));
create policy "QEWI can update their firm" on public.firms
  for update to authenticated
  using (private.is_firm_qewi(id))
  with check (private.is_firm_qewi(id));

-- memberships: members read their firm's list. Changes only via functions.
create policy "Members can read their firm's memberships" on public.memberships
  for select to authenticated
  using (private.is_firm_member(firm_id));

-- inspectors: members read; QEWI manages. A linked user must be in the firm.
create policy "Members can read their firm's inspectors" on public.inspectors
  for select to authenticated
  using (private.is_firm_member(firm_id));
create policy "QEWI can add inspectors" on public.inspectors
  for insert to authenticated
  with check (
    private.is_firm_qewi(firm_id)
    and (
      user_id is null
      or exists (
        select 1 from public.memberships m
        where m.user_id = inspectors.user_id and m.firm_id = inspectors.firm_id
      )
    )
  );
create policy "QEWI can update inspectors" on public.inspectors
  for update to authenticated
  using (private.is_firm_qewi(firm_id))
  with check (
    private.is_firm_qewi(firm_id)
    and (
      user_id is null
      or exists (
        select 1 from public.memberships m
        where m.user_id = inspectors.user_id and m.firm_id = inspectors.firm_id
      )
    )
  );
create policy "QEWI can delete inspectors" on public.inspectors
  for delete to authenticated
  using (private.is_firm_qewi(firm_id));

-- invitations: QEWI only (tokens are secret). Accepting is via a function.
create policy "QEWI can read invitations" on public.invitations
  for select to authenticated
  using (private.is_firm_qewi(firm_id));
create policy "QEWI can create invitations" on public.invitations
  for insert to authenticated
  with check (
    private.is_firm_qewi(firm_id)
    and invited_by = (select auth.uid())
    and accepted_at is null
    and accepted_by is null
  );
create policy "QEWI can revoke open invitations" on public.invitations
  for delete to authenticated
  using (private.is_firm_qewi(firm_id) and accepted_at is null);

-- ---------------------------------------------------------------------------
-- Functions called by the app
-- ---------------------------------------------------------------------------

-- Creates a firm and makes the caller its QEWI, in one transaction.
-- ASSUMPTION: whoever creates the firm administers it with the qewi role.
create function public.create_firm(p_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_name text := btrim(coalesce(p_name, ''));
  v_firm uuid;
begin
  if v_user is null then
    raise exception 'You need to sign in first.' using errcode = '28000';
  end if;
  if char_length(v_name) not between 1 and 200 then
    raise exception 'Enter a firm name (up to 200 characters).' using errcode = '22023';
  end if;
  if exists (select 1 from public.memberships where user_id = v_user) then
    raise exception 'You already belong to a firm.' using errcode = '23505';
  end if;

  insert into public.firms (name) values (v_name) returning id into v_firm;
  insert into public.memberships (firm_id, user_id, role) values (v_firm, v_user, 'qewi');
  return v_firm;
end;
$$;

-- Joins the firm named in an invitation. The signed-in user's confirmed email
-- must match the invitation's email.
create function public.accept_invitation(p_token uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_email text;
  v_confirmed timestamptz;
  v_inv public.invitations%rowtype;
begin
  if v_user is null then
    raise exception 'You need to sign in first.' using errcode = '28000';
  end if;

  select lower(email), email_confirmed_at into v_email, v_confirmed
  from auth.users where id = v_user;

  select * into v_inv from public.invitations where token = p_token for update;
  if not found then
    raise exception 'This invitation link is not valid.' using errcode = 'P0002';
  end if;
  if v_inv.accepted_at is not null then
    raise exception 'This invitation has already been used.' using errcode = '22023';
  end if;
  if v_inv.expires_at < now() then
    raise exception 'This invitation has expired. Ask your QEWI for a new one.' using errcode = '22023';
  end if;
  if v_confirmed is null or v_inv.email <> v_email then
    raise exception 'This invitation was sent to a different email address.' using errcode = '42501';
  end if;
  if exists (select 1 from public.memberships where user_id = v_user) then
    raise exception 'You already belong to a firm.' using errcode = '23505';
  end if;

  insert into public.memberships (firm_id, user_id, role)
  values (v_inv.firm_id, v_user, v_inv.role);
  update public.invitations
  set accepted_at = now(), accepted_by = v_user
  where id = v_inv.id;
  return v_inv.firm_id;
end;
$$;

-- What the invite page shows before sign-in. Anyone holding the token can see
-- the firm name and invited email, nothing else.
create function public.invitation_preview(p_token uuid)
returns table (firm_name text, email text, status text)
language sql
stable
security definer
set search_path = ''
as $$
  select
    f.name,
    i.email,
    case
      when i.accepted_at is not null then 'used'
      when i.expires_at < now() then 'expired'
      else 'open'
    end
  from public.invitations i
  join public.firms f on f.id = i.firm_id
  where i.token = p_token;
$$;

-- Members of the caller's firm, with emails (auth.users is not readable).
create function public.firm_members()
returns table (user_id uuid, email text, role public.member_role, joined_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select m.user_id, u.email::text, m.role, m.created_at
  from public.memberships m
  join auth.users u on u.id = m.user_id
  where m.firm_id = (
    select firm_id from public.memberships where user_id = (select auth.uid())
  )
  order by m.created_at;
$$;

revoke all on function public.create_firm(text) from public, anon;
revoke all on function public.accept_invitation(uuid) from public, anon;
revoke all on function public.firm_members() from public, anon;
revoke all on function public.invitation_preview(uuid) from public;
grant execute on function public.create_firm(text) to authenticated;
grant execute on function public.accept_invitation(uuid) to authenticated;
grant execute on function public.firm_members() to authenticated;
grant execute on function public.invitation_preview(uuid) to anon, authenticated;
