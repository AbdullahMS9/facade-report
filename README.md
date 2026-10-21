# Facade Report

Web app that helps NYC facade (FISP / Local Law 11) inspectors turn field photos
and notes into a draft report and check it before filing with DOB.

Pre-MVP. See `CLAUDE.md` for scope, domain rules and conventions.

## Setup

```bash
cp .env.example .env.local   # fill in values; never commit .env.local
npm install                  # needs npm >= 10.9
npm run dev
```

Checks: `npm run typecheck`, `npm run lint`, `npm test`.
