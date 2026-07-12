# AGENTS.md

## Mission

You are working on the backend of the Practice Service project.

Your primary objective is NOT to write as much code as possible.

Your objective is to produce the smallest correct change that preserves the target architecture.

This repository is expected to exist for many years.

Always optimize for:

1. correctness
2. architectural consistency
3. maintainability
4. small diffs
5. readability
6. explicit business logic

Never optimize for producing the largest amount of code.

---

# Repository Status

IMPORTANT

This repository is currently in an architecture transition.

`backend/prisma/schema.prisma` already reflects the target architecture.

Large parts of `src/modules/**` may still reference the old model: `CohortRole`, `SurveyField`, `StudentDocumentData`, `TaskCard`, `Application.cohort_id`, `Application.role_id`, `Application.review_comment`.

Legacy runtime still exists.

Target architecture already exists in documentation and in `schema.prisma`.

When there is a conflict between:

- old implementation
- target architecture

always move the implementation towards the target architecture.

Never introduce new legacy code.

Never model a new feature after an existing legacy module "for consistency" — the existing module may itself be the thing being replaced.

Legacy code may only be modified when:

- fixing the migration
- fixing compatibility required to keep the build green
- explicitly requested by the user

Do not delete legacy code unless explicitly told the migration and E2E scenarios for that area are complete.

Do not build a temporary compatibility API between old and new models unless the user has approved this via an ADR. This is a known anti-pattern for this cutover and is rejected by design.

`backend/prisma/(old) schema.prisma` is a historical reference file, not a live schema. Never restore it, never treat it as a source of truth.

---

# Source of Truth

Priority order.

1.
Current task description given by the user.

2.
Latest approved architecture documents (ТЗ, ERD/redesign doc, ROADMAP).

3.
`backend/prisma/schema.prisma`.

4.
`docs/api-contract.md` (may itself be stale until the contract-freeze task is done).

5.
Existing implementation.

Existing implementation is NOT always correct.

Do not assume current code reflects desired architecture.

If a document referenced above is not present in the repository, ask the user for it before making an architectural decision — do not guess.

---

# Project Overview

Backend stack

- Node.js
- Express 5
- TypeScript
- Prisma 7
- PostgreSQL

Infrastructure

- Docker
- CI
- Vitest

Architecture

Modular monolith.

Business logic belongs inside `modules/<domain>/<domain>.service.ts`.

Controllers stay thin: parse request, call service, return response.

Each module exports a Router. Only the designated owner of `src/index.ts` mounts routers into the app.

---

# Domain Model — Non-Negotiable Rules

Central aggregate is `Application`: `User → Application → Track → Cohort`.

Everything specific to one practice attempt hangs off `Application`, never off `User` directly.

Do not duplicate a derivable foreign key.

- `Application` does not store `survey_id` — derive via `track_id → cohort_id → survey_id`.
- `TestTaskSubmission` does not store `test_task_id` — derive via `application_id → track_id → test_task_id`.

Use the EAV pattern (`Document`/`DocumentFieldValue`) only for document fields. Do not apply EAV to any other module.

Statuses and types are enum-strings, not lookup tables: `Cohort.status`, `Application.status`, `Report.status`, `Document.type`, `DocumentFieldValue.filled_by`. Validate these at the DTO/Zod layer, not via FK.

Document availability (e.g. "can generate title page") is always computed on read from `Report.status` and `DocumentFieldValue` completeness. Never cache this as a stored flag. Never add a field like `Document.unlockedByAdmin`.

`DailyTask` belongs to `Application`, not to `User`.

One `DailyTask` row per day per application. Enforce `UNIQUE(application_id, task_date)` at the database level. Multiple artifact links go in a child table `DailyTaskLink` (1:N).

`DailyTask` rows for the full practice period are pre-generated inside the same transaction that moves `Application.status` to `approved`. This must be idempotent. Do not lazily create rows on first save.

A missed day is derived as `task_date <= CURRENT_DATE AND description IS NULL`. This is a read-time query, not a stored flag.

Cohort context is always passed explicitly (route param or header) and verified server-side. `User.active_cohort_id` is a UI preference only — never treat it as an authorization source. Public survey access is authorized only via a valid `Invitation.token`.

Organization data (ИП Езуб) is a hardcoded constant for MVP. Do not build a generic multi-organization abstraction unless asked.

Required-field configuration per `Document.type` lives in backend code/config, not in the database.

If a file is replaced (Survey attachment, Report, TestTaskSubmission), either explicitly delete the old file from storage or explicitly document the decision to leave it orphaned. Never leave this undecided.

---

# Ownership Zones

If the user tells you which role you are acting as, stay inside that zone. If not told, ask, or infer conservatively from the task and touch nothing else.

| Zone | Owner | Paths |
|---|---|---|
| Prisma + admissions | Backend A | `prisma/**`; `modules/{auth,cohort,invitation,track,survey,application,test-task}`; `auth.middleware.ts`, `role.middleware.ts`, `cohortContext.middleware.ts` |
| Platform + practice execution | Backend B | `src/index.ts`; `shared/**`; `error.middleware.ts`; `modules/{documents,tasks,admin}`; Docker/CI/package scripts; final `docs/api-contract.md` |
| Client | Frontend | `frontend/**` — out of scope for this file |

Rules that follow from this:

- Never edit `prisma/schema.prisma` or run a migration unless told you are acting as Backend A / Prisma owner.
- Never mount a new router into `src/index.ts` yourself. Export the router and stop.
- Never edit `docs/api-contract.md` directly during parallel development. Edit the owner's fragment file (`docs/api/admissions.md` or `docs/api/practice.md`) instead.

---

# Commands

Verify against `package.json` if these differ.

```bash
npm install
npx prisma generate
npx prisma migrate dev
npx prisma migrate deploy
npm run dev
npm run build
npm test
npx vitest run <path>
```

Definition of done for any change:

1. `npx prisma validate && npx prisma generate` pass, if schema changed.
2. `npm run build` passes.
3. `npm test` is green for touched modules.
4. If the HTTP contract changed, the relevant `docs/api/*.md` fragment is updated in the same change.

---

# Coding Rules

- DTOs validate input via Zod. Use the shared error envelope: `{ code, message, details, requestId }`.
- Wrap multi-write critical flows in a Prisma transaction: application creation + answers, approve + daily-task calendar generation, report upload + status reset.
- Access files only through the shared storage abstraction. Never build a file path from a user-supplied filename. Use generated UUID names.
- Never trust client-side role/auth state. The server re-derives authorization from the JWT and database on every request.
- Match existing module shape: `modules/<domain>/{<domain>.controller.ts, <domain>.routes.ts, <domain>.service.ts, dto/*.dto.ts}`.

---

# Prohibited Without Explicit User Request

- Editing `prisma/schema.prisma` or migrations outside the Prisma-owner role.
- Mounting routes in `src/index.ts`.
- Deleting legacy modules (`cohort-role`, old survey/document/task services) before migration + E2E are confirmed complete.
- Introducing a compatibility layer between old and new models without an approved ADR.
- Inventing a new table/entity where the design docs specify an enum-string or EAV field instead.
- Committing `.env` secrets or files from `uploads/`.

---

# Known Pitfalls

- `DATABASE_URL` mismatch between `.env` and the applied migration previously caused phantom `409 Conflict` responses. If a conflict looks wrong, verify which database the running process is actually connected to before debugging application logic.
- `backend/prisma/(old) schema.prisma` exists for reference only — see Repository Status.
- Frontend build issues (Next.js/Turbopack) are unrelated to backend build failures; do not conflate them when diagnosing CI.

---

# Where to Look for Task Detail

For a specific stage or business rule, find its number (e.g. `009`, `031`) in `ROADMAP_НОВАЯ_АРХИТЕКТУРА.md` and the matching rationale in the DB redesign document. If a business rule is explicitly specified there, follow it exactly — do not improvise. If the document is missing from the repo, ask the user rather than guessing.