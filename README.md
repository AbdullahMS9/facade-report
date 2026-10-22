# Facade Report

Web app (installable on phones) that helps NYC facade inspectors (FISP / Local Law 11)
turn field photos and notes into a draft report, check it against the rules, and export
an editable Word report.

Pre-MVP. See `CLAUDE.md` for scope, domain rules, conventions and deploy steps.

## Local setup

Needs Node 20.9+ (npm 10.9+) and Docker.

```bash
npm install
npm run db:start             # local Supabase; prints URL and local keys
cp .env.example .env.local   # fill in values from `npx supabase status`
npm run dev                  # http://localhost:3000
```

Sign-in codes go to the local Mailpit inbox at http://127.0.0.1:54324.

Checks: `npm run typecheck`, `npm run lint`, `npm test`, `npm run test:db`, `npm run test:e2e`.

All seed and test data is fictional. Never commit real reports, photos or client data.
