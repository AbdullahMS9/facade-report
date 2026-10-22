-- Fields the checker needs (CLAUDE.md §3.3, §3.7).

-- §103-04(c)(2)(v) exceptions to the cavity wall probe requirement.
create type public.probe_waiver as enum ('tie_repair', 'new_building', 'alternate_method');

alter table public.projects
  -- Public protection for UNSAFE conditions, e.g. "Sidewalk shed installed Oct 3".
  add column public_protection_note text check (char_length(public_protection_note) <= 1000),
  -- null = no waiver; probes are required where they apply.
  add column probe_waiver public.probe_waiver,
  add column probe_waiver_note text check (char_length(probe_waiver_note) <= 2000);
