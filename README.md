# Facade Report

Web app that helps NYC facade (FISP / Local Law 11) inspectors turn field photos
and notes into a draft report and check it before filing with DOB.

Pre-MVP. See `CLAUDE.md` for scope, domain rules and conventions.

## Setup

Needs Node 20.9+ (npm 10.9+) and Docker.

```bash
npm install
npm run db:start             # local Supabase; prints URL and local keys
cp .env.example .env.local   # fill in values from `npx supabase status`
npm run dev                  # http://localhost:3000
```

Sign-in codes are emailed to the local Mailpit inbox at http://127.0.0.1:54324.

Checks: `npm run typecheck`, `npm run lint`, `npm test`, `npm run test:db`.
