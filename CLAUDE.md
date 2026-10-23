# CLAUDE.md — Facade Report

Read this whole file at the start of every session. It is the source of truth for
what we are building, why, and how. If something here conflicts with a request,
ask before acting. When a decision changes, update this file in the same commit.

---

## 1. What we are building

A web app (installable on phones) that helps NYC facade inspectors turn field
photos and notes into a draft FISP report, and catches mistakes before the report
is filed with the NYC Department of Buildings (DOB).

- **Who uses it:** engineering and architecture firms that perform FISP
  (Local Law 11) facade inspections. The licensed professional who signs the
  report is the **QEWI**. Field staff often do the photos and notes for them.
- **The job it does:** cut the hours between "last field visit" and "report ready
  to file," and reduce DOB rejections.
- **What it is not:** it does not decide whether a building is safe. The QEWI
  makes every classification and signs and seals the report. The app drafts,
  organizes and checks.

### Current stage

Pre-MVP. Solo developer, built part-time (10–20 hrs/week) with Claude Code.
No customer interviews yet. Build the MVP so it is easy to change once real
inspectors give feedback. Prefer simple, readable code over clever abstractions.

---

## 2. Domain primer (read before touching business logic)

- **Facade:** the exterior walls of a building and everything attached to them.
- **FISP:** Facade Inspection & Safety Program, also called Local Law 11. Every NYC
  building taller than six stories gets a facade inspection every 5 years
  (about 17,000 buildings). Rules live in **1 RCNY §103-04**.
- **QEWI:** Qualified Exterior Wall Inspector. A NY-licensed PE or RA approved by
  DOB. About 484 exist. Only a QEWI can sign and file a FISP report.
- **Cycle / filing window:** each building files once per 5-year cycle, inside a
  2-year window set by the last digit of its tax block number. Cycle 10 began
  Feb 21, 2025.
- **Elevation:** one side of the building (north, east, etc.). Elevations that face
  a street ("front a public right-of-way") have stricter requirements.
- **Drop / close-up inspection:** a hands-on inspection from grade to roof on a
  scaffold, swing stage, boom lift or rope. Required at intervals of no more
  than 60 ft along street-facing elevations.
- **Cavity wall:** an outer brick layer tied to an inner wall with metal ties across
  an air gap. **Probes** (opening the wall or using a borescope) confirm the ties.
- **Appurtenances:** things attached to the wall: fire escapes, railings and guards,
  balconies, signs, parapets, window air conditioners, antennas, and so on.
- **Classifications:**
  - **SAFE:** no repair needed; will not become unsafe within 5 years.
  - **SWARMP:** Safe With A Repair and Maintenance Program. Safe now, but needs
    repair within the next 5 years and not less than 1 year.
  - **UNSAFE:** hazardous; requires repair within 1 year. Requires public
    protection (usually a sidewalk shed) and immediate notice to DOB and the owner.
  - A SWARMP condition from the previous report that is still not repaired **must
    be reported as UNSAFE** ("administrative unsafe").
  - Building status = the worst condition found (any UNSAFE → UNSAFE; else any
    SWARMP → SWARMP; else SAFE).
- **Report types:** Initial (the cycle's report), Subsequent (changes a status or
  time frame during the cycle), Amended (certifies UNSAFE conditions repaired).
- **DOB NOW: Safety:** DOB's online portal where the QEWI files the report. We do
  **not** integrate with it in the MVP; we produce a filing-ready package.
- **PIPS / Local Law 126:** the same idea for parking garages (QPSI inspectors).
  Out of scope for the MVP, but keep the data model general enough to add it.

---

## 3. Rules to encode (from 1 RCNY §103-04)

All rules live in one pure, tested module: `src/lib/rules/`. No rule logic in UI
components. Each rule cites its section in a comment. Rules can change (Local Law
49 of 2025 allows 6–12 year intervals; DOB proposed changes for Cycle 11 in 2030),
so keep values in a config object, not scattered constants.

Source: https://www.nyc.gov/assets/buildings/rules/1_RCNY_103-04.pdf
Confirm against the current rule text before treating anything as final:
https://codelibrary.amlegal.com/codes/newyorkcity/latest/NYCrules/0-0-0-2825

### 3.1 Filing window (staggered cycle)
Windows open Feb 21 and close Feb 21 two years later.

| Block number ends in | Window starts in years ending | Cycle 10 window |
| --- | --- | --- |
| 4, 5, 6, 9 | 0 and 5 | Feb 21, 2025 – Feb 21, 2027 |
| 0, 7, 8 | 1 and 6 | Feb 21, 2026 – Feb 21, 2028 |
| 1, 2, 3 | 2 and 7 | Feb 21, 2027 – Feb 21, 2029 |

### 3.2 Required close-up inspections (per street-facing elevation)
Minimum count = `floor(frontageFeet / 60) + 1` for frontage > 0.
(Under 60 ft → 1; 60 to <120 → 2; 120 to <180 → 3; and so on.)
Elevations not facing a street: a representative sample; at least one close-up
examination per building overall. Drones and photos do **not** replace close-ups.

### 3.3 Cavity wall probes
At least one probe along each close-up interval, in areas not previously renovated.
Exceptions: tie repair campaign within 10 years of the filing deadline (with proof);
first TCO/CO within 10 years (with evidence of ties); or a DOB-accepted alternate method.
**Open question:** the rule text says probes are required "starting with the ninth
cycle and every subsequent odd-numbered cycle," but other DOB material describes
them as currently required. Make probe requirements a per-cycle config flag and
confirm with a QEWI.

### 3.4 Filing time limits
- File within **60 days** of the QEWI's final inspection (the final visual walk-around).
- File no more than **1 year** after the close-up inspection was completed.
- Must be inside the building's filing window.
- Deadline shown to the user = earliest of those three dates.
- A rejected report must be revised and refiled within 45 days.

### 3.5 Required report contents (critical examination report)
The export must contain sections for each of these, in roughly this order:
1. Executive overview: findings, scope, conclusions, recommendations, building classification.
2. Building identifiers: address, block and lot, BIN, landmark status, nearest cross street.
3. Owner: name, mailing address, phone; for an entity, a principal's name and title.
4. Building description: stories, height, dimensions, C of O number, use, exterior
   wall materials and their age.
5. Distress, settlement and repairs since the previous report.
6. Examination procedures and extent of close-up and probe examinations.
7. Names and license numbers of riggers, contractors and consultants.
8. Located diagram: north arrow, elevation lengths, setbacks, inspection locations and dates.
9. Start and completion dates of the examination.
10. Dated photos of the QEWI or staff performing close-up inspections.
11. Each condition classified and located; list of appurtenances; guards and
    railings checked for secure attachment.
12. Causes of UNSAFE and SWARMP conditions.
13. Status of maintenance work and the maintenance plan.
14. Comparison with the prior cycle: prior conditions, permit and job numbers,
    open ECB violations.
15. Recommended repairs with completion dates (UNSAFE: within 1 year;
    SWARMP: not less than 1 year and within 5 years).
16. Required work permits.
17. Photographs (see 3.6).
18. QEWI seal and signature block (left blank for the QEWI).

### 3.6 Photo rules
- Color, legible, dated, at least **800 × 600 px**. Keep originals; export copies.
- Elevation photos: the house number and at least one full view of each street elevation.
- Every SWARMP and UNSAFE condition photographed, labeled with its status.
- A SAFE building still needs at least three photos of typical conditions.
- Probe photos: openings, wall cross section, tie type and spacing, relieving angles.
- Dated photo of the QEWI or staff doing the close-up inspection.

### 3.7 Pre-filing checks (the "checker")
Each check returns `{ id, passed, severity: "blocker" | "warning", message, fix }`.
Messages are plain English and say how to fix the problem.
- Building identifiers complete (address, block, lot, BIN).
- Exterior wall materials listed.
- Every street elevation has at least the required close-up count.
- Probe count meets the requirement where probes apply.
- Every SWARMP/UNSAFE condition has at least one photo and a status label.
- SAFE building has at least 3 typical-condition photos.
- All photos meet 800 × 600 minimum and carry a date.
- Dated QEWI/staff close-up photo attached.
- Every prior-cycle SWARMP item marked repaired or carried forward as UNSAFE.
- Every SWARMP/UNSAFE condition has a recommended repair and a completion date
  that fits its classification's time limits.
- If any UNSAFE: owner and DOB notification recorded; public protection noted.
- Deadline not passed; date falls inside the filing window.

---

## 4. MVP scope

### In
1. **Firm accounts:** email sign-in, one firm per user, invite teammates. Roles:
   `qewi`, `staff`. Every row is scoped to a firm.
2. **Projects:** one project = one building + one report (cycle, report type).
3. **Building setup:** address, borough, block, lot, BIN, stories, height, year
   built, materials, cavity wall yes/no, landmark yes/no, owner info.
   Auto-fills filing window and deadline.
4. **Prior history from NYC Open Data:** look up the building's earlier facade
   filings and show prior status. Read-only, cached.
5. **Elevations:** name, faces street yes/no, frontage in feet, setbacks; required
   close-up count computed; record drops (location, date) and probes.
6. **Field capture (phone first):** take or upload photos; tag elevation, floor,
   drop, element, condition, classification, notes, recommended repair, repair
   date. Must work offline and sync later.
7. **Prior-cycle items:** list last cycle's SWARMP items; mark repaired or carried
   forward (auto UNSAFE).
8. **Checker:** the checks in 3.7, always visible.
9. **Report export:** editable `.docx` following 3.5, with a numbered photo
   appendix and captions. Word, because firms paste into their own templates.

### Out (do not build unless asked)
- Filing into DOB NOW or any DOB integration.
- AI defect detection, drone imports, 3D.
- Billing and payments.
- Owner/client portal.
- Garages (PIPS), other cities, native iOS/Android apps.

### Definition of done for the MVP
A field user can create a project on a phone, capture 20+ photo-backed
conditions offline, sync, and a QEWI can open the checker, fix what it flags,
and download a `.docx` that follows section 3.5.

---

## 5. Tech stack

| Layer | Choice |
| --- | --- |
| Framework | Next.js (App Router) + TypeScript (`strict: true`) |
| Styling | Tailwind CSS |
| Database, auth, storage | Supabase (Postgres, Auth, Storage) with Row Level Security; `@supabase/ssr` for Next.js cookie sessions |
| Offline | PWA + IndexedDB (Dexie) queue for observations and photos |
| Images | Client-side resize/compress before upload; keep capture date |
| Word export | `docx` npm package |
| Validation | Zod for all inputs and API payloads |
| Tests | Vitest for logic (pinned to 4.x + Vite 6); Playwright (`tests/e2e/`) for critical flows at 390px |
| Hosting | Vercel |

Rules:
- Ask before adding any dependency not listed here.
- Pin dependency versions. Use the npm registry only.
- No paid services without asking.

### Suggested structure
```
src/
  app/                 # routes and pages
  components/          # UI only, no business rules
  lib/
    rules/             # FISP rules + checker (pure, fully tested)
    report/            # docx builder
    opendata/          # NYC Open Data client
    offline/           # IndexedDB queue + sync
    db/                # Supabase client + typed queries
  types/
supabase/
  migrations/          # SQL migrations, one per change
tests/
```

---

## 6. Data model (starting point)

All tables have `id uuid`, `firm_id uuid`, `created_at`, `updated_at`.
RLS: a user can only read and write rows where `firm_id` matches their membership.

- `firms` — name
- `memberships` — user_id, firm_id, role (`qewi` | `staff`)
- `inspectors` — firm_id, user_id, name, license_type (`PE` | `RA`), license_number
- `buildings` — address, borough, block, lot, bin, cross_street, stories, height_ft,
  year_built, co_number, use, materials (text[]), materials_notes, is_cavity_wall,
  is_landmark (both nullable = not answered), owner_name, owner_address, owner_phone,
  owner_principal_name, owner_principal_title
- `projects` — building_id, cycle (e.g. 10), report_type (`initial` | `subsequent` |
  `amended`), qewi_id, status (`draft` | `ready` | `filed`), exam_start, exam_end,
  final_visual_date, closeup_complete_date, unsafe_notified_on, public_protection_note,
  probe_waiver (`tie_repair` | `new_building` | `alternate_method`, nullable), probe_waiver_note
- `elevations` — project_id, name, faces_street, frontage_ft, setbacks_note, sort_order
- `closeups` — elevation_id, location_note, inspected_on, method (`scaffold` | `swing_stage` |
  `boom_lift` | `rope`)
- `probes` — closeup_id, location_note, probed_on, tie_type, tie_spacing, tie_condition
- `observations` — project_id, elevation_id, closeup_id (nullable), floor, element,
  condition, classification (`safe` | `swarmp` | `unsafe`), cause, notes,
  recommended_repair, repair_by_date
- `photos` — project_id, observation_id (nullable; required for `condition`), kind
  (`condition` | `elevation` | `inspector` | `probe` | `typical`), original_path, display_path,
  original_type, taken_at, taken_at_source (`exif` | `file`), width, height (original,
  upright), caption
- `prior_items` — project_id, description, location_note, repaired (nullable bool: null = not decided),
  notes. Entered by hand (Open Data has no condition-level data).
- `contractors` — project_id, role (`rigger` | `contractor` | `consultant`), name, license

Child tables reference parents by `(id, firm_id)` so rows can't link across firms.
Members read/add/edit; only the QEWI deletes or changes a project's status (trigger).

Photos go in a **private** storage bucket and are served with short-lived signed URLs.
Bucket `photos`, paths `<firm>/<project>/<photo>/original.<ext>` and `display.jpg`
(longest side ≤ 2000 px, upright JPEG). Storage rules check the firm from the first folder;
files are never overwritten; only the QEWI deletes.

---

## 7. NYC Open Data

- Dataset: "DOB NOW: Safety – Facades Compliance Filings", id `xubg-57si`.
- API: `https://data.cityofnewyork.us/resource/xubg-57si.json` (Socrata/SODA).
  Updated every weekday. ~87,000 rows (Oct 2026), cycles 6–10. Works without a token.
- **One row per filing** (or per missed filing). It has **statuses only, not the
  individual conditions**, so prior SWARMP items can't be imported; inspectors enter
  them (`prior_items`).
- Query by BIN, or by borough + block + lot. Cache results; never block the UI on it.
  Placeholder BINs (`[1-5]000000`, ~29 rows) are not unique: use borough/block/lot.
- An app token (free) raises rate limits. Keep it in env vars (`NYC_OPEN_DATA_APP_TOKEN`).
- Rows contain real owner and QEWI names (public data). Never put real rows in the repo;
  test fixtures are fictional.

Field names (checked 2026-10-21; every field is `text` except the `calendar_date` ones):

| Field | Notes |
| --- | --- |
| `tr6_no` | Filing number, e.g. `TR6-000000-8A-I1` |
| `control_no`, `sequence_no` | DOB control and sequence numbers |
| `filing_type` | `Initial`, `Subsequent`, `Amended`, `Auto-Generated` (placeholder for a missing report) |
| `cycle` | `"6"`–`"10"` as text (sort numerically) |
| `bin` | 7 digits |
| `house_no`, `street_name` | Address parts |
| `borough` | `Manhattan`, `Bronx`, `Brooklyn`, `Queens`, `Staten Island` |
| `block`, `lot` | Text, no leading zeros in almost all rows (121 exceptions) |
| `filing_status` | `SAFE`, `SWARMP`, `UNSAFE`, `No Report Filed` (status in this filing) |
| `current_status` | Building's current status for that cycle; may be blank |
| `prior_status` | Status from the previous cycle, as reported in this filing |
| `filing_date`, `submitted_on`, `prior_cycle_filing_date` | `calendar_date` |
| `field_inspection_completed_date`, `qewi_signed_date` | `calendar_date` |
| `qewi_name`, `qewi_nys_lic_no` | e.g. `PE - 000000` |
| `qewi_bus_name`, `qewi_bus_street_name`, `qewi_city`, `qewi_state`, `qewi_zip` | QEWI firm |
| `owner_name`, `owner_bus_name`, `owner_bus_street_name`, `owner_city`, `owner_state`, `owner_zip` | Owner (not stored by us) |
| `late_filing_amt`, `failure_to_file_amt`, `failure_to_correct_amt` | Penalties, text dollars |
| `comments` | Free text |
| `exterior_wall_type_s_`, `exterior_wall_type_other_description` | e.g. `BRICK MASONRY` |
| `exterior_wall_material_s_`, `exterior_wall_material_other_description` | e.g. `MASONRY` |

## 8. Security and privacy

- **This repository is public.** Never commit secrets, keys, real client data,
  real reports or real building photos. `.env*` must be in `.gitignore` from the
  first commit. Use `.env.example` with placeholder names only.
- Supabase **service role key is server-only.** Never ship it to the browser.
- Enable RLS on every table before inserting any data. Write a test that a user
  from firm A cannot read firm B's rows.
- Validate every input with Zod on the server.
- Seed and demo data must be clearly fictional (made-up addresses, names, photos).
- Do not use any employer's or third party's templates, reports, logos or data.

---

## 9. How to work in this repo

- **Plan first** for anything bigger than a small fix: list the files to touch and
  the steps, then wait for a go-ahead.
- Work in small steps. One feature per branch or per commit series.
  After each step: run typecheck, lint and tests; fix failures before moving on.
- Every rule in `src/lib/rules/` has unit tests, including edge cases
  (frontage exactly 60/120 ft, block digit boundaries, dates on window edges,
  SWARMP carried forward).
- Commit messages: imperative, specific ("Add close-up count rule and tests").
- UI copy: plain English, from the inspector's point of view. Use the real terms
  (SWARMP, QEWI, drop, probe) because users know them.
- Mobile first. Test field screens at 390px width with large tap targets.
- When unsure about a FISP rule, say so and add it to Open Questions below.
  Never invent a rule.

### Commands
```
npm run dev         # local dev server (http://localhost:3000)
npm run typecheck   # next typegen + tsc --noEmit
npm run lint        # eslint
npm test            # unit tests (no database needed)
npm run test:db     # RLS + auth tests against local Supabase
npm run test:e2e    # Playwright flows at 390px (builds + starts prod server on :3100, fake Open Data; needs db:start)
npm run db:start    # start local Supabase in Docker (Studio :54323, Mailpit :54324)
npm run db:stop
npm run db:reset    # re-apply all migrations from scratch
npm run db:types    # regenerate src/types/database.ts after a migration
npm run build       # production build
npm run db:seed-demo  # fictional demo project for DEMO_EMAIL (.env.seed.local), local db
npm run test:smoke  # read-only checks against SMOKE_URL (a deployed site)
```
Node >= 20.9 with npm >= 10.9 (dev machine: Node 24 via nvm). npm 10.8.x crashes on
install (`reading 'edgesOut'`). Local sign-in emails land in Mailpit, not real inboxes.
`.env.local` holds the local demo keys printed by `npx supabase status`.
After a Mac restart run `npm run db:stop && npm run db:start`: Docker revives the old
containers without the custom email templates, and sign-in emails fall back to defaults.

### Auth and tenancy (built in step 3)
- Sign-in is email + 6-digit code (no magic links: links open outside the installed PWA).
- `supabase/config.toml` keeps `enable_confirmations = true`; `accept_invitation` relies on
  confirmed emails. **Turn "Confirm email" on in the hosted project too**, and set the same
  email templates (`supabase/templates/`).
- Firms and memberships are only created through `create_firm` / `accept_invitation`.
- The service-role client (`src/lib/db/admin.ts`) is used only to send invite emails.
- Every new table: `firm_id`, RLS enabled in the same migration, policies via
  `private.is_firm_member` / `private.is_firm_qewi`, and cases added to `tests/db/` RLS tests.

### UI conventions (built in step 4)
- Forms use `src/components/ActionForm.tsx` (keeps typed values when the server returns
  an error) with server actions that validate with Zod schemas in `src/lib/schemas/`.
- Labels are linked to controls by `id` (`f-<name>`), so tests and screen readers use
  `getByLabel("…")`. Give repeated forms on one page their own `id`s.
- Pages call `src/lib/rules/` helpers (`filingSummary`, `elevationProgress`, `probesApply`);
  no rule logic in components. "Today" is New York time (`src/lib/today.ts`).
- Back links use `BackLink`; deletes use `ConfirmDelete` and are QEWI-only.

### Photos (built in step 6)
- In the browser, `src/lib/photos/prepare.ts` reads the EXIF capture date
  (`exif.ts`; no EXIF → file date, flagged), makes the upright display copy, and flags
  photos under 800 × 600. Upload order: both files, then `recordPhoto` saves the row with
  paths the server builds. Step 7 can queue these same steps offline.
- If saving the row fails after upload, the files stay in storage (staff can't delete
  files). Harmless, but a cleanup job may be worth adding later.
- When an input's files are processed with `await`, copy the FileList to an array first:
  resetting the input empties it.

### Checker (built in step 8)
- `src/lib/rules/checker.ts`: `runChecks(input)` returns every §3.7 check plus §3.5
  warnings (QEWI chosen, owner, exam dates, causes, elevation photos, camera dates), each
  `{ id, title, passed, severity, message, fix, related }`. Pure and fully tested.
- `src/app/projects/[id]/load.ts`: `loadChecks(id)` gathers the data (cached per request).
  The project layout shows the checker bar on every project page; `/checker` lists
  everything with fix links (`checkLinks.ts`).
- "Ready to file" / "Filed" are refused while blockers remain; back to Draft always works.
- The probe check stays a blocker; a recorded probe waiver (§3.3 exceptions) clears it.
- Fieldsets and selects use `min-w-0`/`w-full`: a long `<option>` can otherwise widen a
  fieldset past the phone screen and break taps.

### Deploy (step 10)
Hosting: Vercel (Hobby, region `iad1`) + Supabase (free, East US / N. Virginia).
Secrets live only in Vercel env vars and ignored local files (`.env*`).

1. **Supabase project**: create in the dashboard. Then `npx supabase login`,
   `npx supabase link --project-ref <ref>`, `npx supabase db push` (applies
   `supabase/migrations/`, including the private `photos` bucket).
2. **Supabase auth settings** (dashboard → Authentication):
   - Site URL = the Vercel URL; add it to Redirect URLs.
   - Email: "Confirm email" ON; OTP length 6.
   - Email templates: paste `supabase/templates/sign_in_code.html` into "Confirm signup"
     and "Magic Link" (subject "Your Facade Report sign-in code"), and
     `supabase/templates/invite.html` into "Invite user".
   - Built-in email only reaches members of the Supabase team, a few per hour. Add a
     sending service (custom SMTP) before inviting real users. (Needs a domain; ask first.)
3. **Vercel**: import the GitHub repo. Env vars: `NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (server only),
   `NEXT_PUBLIC_SITE_URL` (the Vercel URL), optional `NYC_OPEN_DATA_APP_TOKEN`.
   Pushes to `main` deploy automatically.
4. **Demo data**: put the hosted URL and service-role key in an ignored file (e.g.
   `.env.hosted.local`) and `DEMO_EMAIL` in `.env.seed.local`, then
   `node --env-file=.env.hosted.local --env-file=.env.seed.local scripts/seed-demo.mjs`.
   Reseed after Feb 21, 2027: the demo's block (…4) window closes then.
5. **Smoke test**: `SMOKE_URL=https://<app>.vercel.app npm run test:smoke` (read-only).

`npx supabase db advisors --linked --type security` should list only the intended
SECURITY DEFINER functions: `invitation_preview` (anon, token-gated), `create_firm`,
`accept_invitation`, `firm_members`. Hosted "automatic RLS" adds `rls_auto_enable()`;
migration `20261023000100` removes its API access.

Pre-deploy checks already in the repo: `tests/db/rls-coverage.test.ts` (RLS on every
table, no anon grants, private bucket); server secrets in `src/lib/serverEnv.ts`
(`server-only`, never bundled for the browser); security headers in `next.config.ts`.
Push only `main` (never `--tags`/`--mirror`): a local backup tag from the history
scrub must stay local.

### Report export (built in step 9)
- `GET /projects/[id]/report` builds the `.docx` on the server as the signed-in user.
  `src/lib/report/data.ts` gathers data (photos = display copies from storage);
  `build.ts` is pure and follows §3.5's 18 sections in order.
- Missing data → highlighted "[QEWI to complete: …]" placeholders. Narrative sections
  (5, 7, 13, 16, conclusions, procedures) are always placeholders for now.
- Photos are numbered in a fixed order (elevation, inspector, conditions by elevation,
  probe, typical), two per page, captions carry the status label (§3.6).
- Header says "DRAFT – N checker blockers" until the checker is clear. US Letter, 1" margins.
- Tests read the .docx with `src/lib/report/unzip.ts` (Node zlib). Zip files include
  folder entries (e.g. `word/media/`); skip names ending in `/`.

### Offline (built in step 7)
- New observations and photos are always saved on the phone first (Dexie outbox,
  `src/lib/offline/`), then synced: on app open, when back online, every 30 s while items
  wait, and on "Sync now". One code path online and offline.
- Sync is safe to repeat: ids are made on the phone; `src/lib/offline/serverSync.ts`
  treats a repeat as done and refuses items from another firm. Photos wait for their
  observation; the planner re-runs after each pass that sent something.
- `/field` is a static, browser-only page that works from the phone's data. The service
  worker (`public/sw.js`, production builds only) caches it and `/_next/static/*`, serves
  it for any page load when offline, and refreshes it while online.
- Projects are saved for offline use automatically whenever their overview or
  new-observation page is opened online. Offline you can add observations and photos
  only; editing, elevations, drops and deletes need a signal.
- Sign-out warns about unsynced items, then clears the phone's data.

### Prior filings (built in step 5)
- `src/lib/opendata/facades.ts` (pure client + cache policy) and `history.ts` (server, reads
  and writes `building_filings_cache`). Cache is fresh for 24 h; after a failure it waits
  5 min before retrying. The overview panel streams in via `<Suspense>`.
- `NYC_OPEN_DATA_URL` overrides the API URL; Playwright points it at
  `tests/e2e/fake-opendata.mjs`. If you run `npm run dev` yourself before `test:e2e`, start
  it with that variable or the prior-filings test will hit the real API. (Playwright now
  runs its own production server on port 3100, so this only matters for manual runs.)

---

## 10. Build order

1. Scaffold: Next.js + TypeScript + Tailwind + Supabase; `.gitignore`, `.env.example`.
2. `src/lib/rules/` with filing window, close-up count, classification roll-up,
   deadline, carried-forward items, and tests. (No UI yet.)
3. Auth, firms, memberships, RLS, and the cross-firm access test.
4. Buildings + projects + elevations screens.
5. NYC Open Data lookup for prior filings.
6. Observations + photos (online first).
7. Offline capture and sync.
8. Checker panel.
9. `.docx` export.
10. Deploy to Vercel; seed one fictional demo project.

---

## 11. Open questions (update as answers come in)

- What do firms use today to assemble reports? (Assumed: Word, Excel, photo folders.)
- Most common DOB rejection reasons?
- Is the DOB NOW upload a single PDF, or separate fields and attachments?
- Do firms want our report layout, or export into their own Word template? (Step 9 ships
  our layout with highlighted placeholders; check a generated report with a QEWI.)
- Should the narrative sections (§3.5 items 5, 7, 13, 16) be written in the app, plus a
  riggers/contractors list (`contractors` table, not built yet)?
- Probe requirement in Cycle 10 (see 3.3). §103-04(c)(2)(v) (PDF dated Feb 3, 2026)
  reads "starting with the ninth cycle … and, at a minimum, during every subsequent
  odd-numbered cycle", which literally means Cycle 10 is not required. Coded as
  `probes.requiredInEvenCycles: true` in `src/lib/rules/config.ts` until a QEWI confirms.
- Close-up table thresholds in §103-04(c)(2)(iv) did not extract from the PDF; counts
  1–6 then "one additional" match `floor(L/60)+1`, but confirm the exact boundaries.
- Rule-edge assumptions in `src/lib/rules/` (confirm with a QEWI):
  - A filing on the closing Feb 21 of the window is on time (`endIsInclusive`).
  - "Within 60 days" of final inspection: day 60 is still on time.
  - Close-up completed Feb 29: the 1-year limit falls on Feb 28.
  - A street elevation with 0 ft frontage gets 0 required close-ups (checker flags it).
  - No conditions recorded → building rolls up SAFE (checker requires 3 typical photos).
  - Any unrepaired prior item requiring repair (not only SWARMP) is carried forward as
    UNSAFE, per §103-04(c)(3)(iii)(N).
- Typical report length and photo count per building.
- Pricing: per firm per month vs per report.
- Who sets up a firm account: the QEWI, or an office manager who shouldn't have the `qewi` role?
- Should a project lock once it is `ready` or `filed`? (Today anyone in the firm can still edit.)
- Probe waivers (§103-04(c)(2)(v) exceptions 1–3) are not tracked; where should the proof live?
- SWARMP "next five years, but not less than one year": measured from the final inspection
  (same as UNSAFE)? Coded that way in `checkRepairDate`; confirm with a QEWI.
- 800 × 600 minimum: we accept either orientation (600 × 800 portrait passes). Confirm.
- Offline on real phones: iOS Safari storage limits and eviction for photo blobs in
  IndexedDB, and whether field staff need offline drops or edits. Test on a real iPhone
  added to the home screen.
- iPhone HEIC photos: browsers usually convert to JPEG on upload; if a raw HEIC arrives,
  non-Safari browsers can't read it and we ask for "Most Compatible". Check on real phones.

---

## 12. Decisions log

| Date | Decision | Why |
| --- | --- | --- |
| 2026-10-21 | Web app + PWA instead of native apps | One codebase, no app store, offline via PWA |
| 2026-10-21 | Export `.docx`, not PDF, for MVP | Firms edit and paste into their own templates |
| 2026-10-21 | No DOB NOW integration in MVP | No public filing API; QEWI files manually |
| 2026-10-21 | Pin exact versions released at least ~2 weeks earlier (`.npmrc` save-exact) | Avoid brand-new releases; reproducible installs |
| 2026-10-21 | Next 16.3.8, Vitest 4.1.11, Vite 6.4.4 | Vitest 5 and Vite 7 need Node 20.19+/22; dev machine is on 20.16 |
| 2026-10-21 | Sign in with emailed 6-digit code, not magic link | Magic links open in the browser, not the installed PWA |
| 2026-10-21 | Local Supabase in Docker for dev and DB tests; no hosted project until deploy | Free, no real emails, RLS tests run locally |
| 2026-10-21 | Firm creator gets the `qewi` role | Someone must be able to invite; revisit if office managers set up firms |
| 2026-10-21 | Members add/edit project data; only the QEWI deletes or changes project status | Field staff do data entry; status and deletes are the QEWI's call |
| 2026-10-21 | Building materials as a list + free-text notes (no per-material age) | Simple to enter on a phone; revisit if the report needs a table |
| 2026-10-21 | Playwright added in step 4 (1.63.0, Chromium only) | Needed to check field screens at 390px end to end |
| 2026-10-21 | Cache Open Data per building in `building_filings_cache` (RLS), not Next's fetch cache | Survives deploys, shows "last updated", usable offline later |
| 2026-10-21 | Prior-cycle items entered by hand in step 5 | Open Data has statuses only, no condition-level data |
| 2026-10-21 | Upload the original photo and a 2000 px display copy | §3.6 says keep originals; copies keep pages and export light |
| 2026-10-21 | Own minimal EXIF reader instead of `exifr` | Only the date and orientation are needed; no new dependency |
| 2026-10-21 | Repair limits measured from the QEWI final inspection | §103-04(a) "completion of critical examinations" = final inspection per (c)(2)(viii) |
| 2026-10-21 | Save new observations/photos on the phone first, then sync (online too) | One code path; nothing lost when the signal drops mid-save |
| 2026-10-21 | Hand-written service worker, no Serwist | ~100 lines covers field mode; no new dependency |
| 2026-10-21 | Offline scope: new observations and photos only | Avoids edit conflicts; revisit if field staff need offline drops/edits |
| 2026-10-21 | Playwright runs against a production build on :3100 | Service workers need a production build; avoids reusing a stale dev server |
| 2026-10-22 | Checker blocks "ready to file" until no blockers | §3.7 checks are the point of the app; QEWI can still return to Draft |
| 2026-10-22 | Probe waiver recorded on the project | Lets the probe check stay a blocker without trapping valid exceptions |
| 2026-10-22 | Extra checker warnings from §3.5 report contents | Catch gaps the §3.7 list doesn't cover; never block |
| 2026-10-22 | Report narrative sections are placeholders; no in-app text editor yet | Firms edit the Word file; template question still open |
| 2026-10-22 | Report uses 2000 px display copies, two photos per page | ~20 MB for 50 photos; no server image library needed |
| 2026-10-22 | `docx` pinned at 9.8.1 | Newer releases were under two weeks old |
| 2026-10-22 | Deploy: Vercel (Git integration) + Supabase free tier, East US | Free, close together; pushes to main deploy |
| 2026-10-22 | Start with Supabase built-in email; custom SMTP before real users | Built-in email only reaches the Supabase team; SMTP needs a domain |
| 2026-10-22 | Removed two real Open Data values from history before the first push | §8: no real data in a public repo |
| 2026-10-21 | Accept `braces` audit warning (eslint-config-next dev dependency) | Dev-only lint tooling; only “fix” is downgrading to Next 14 lint config |
