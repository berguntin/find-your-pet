# Find your pet

Lost and found pets board. A single Nuxt app (`frontend/`) serves both the UI and the API (`/api/v1`),
backed by Postgres and Cloudinary.

## Architecture

The server follows a hexagonal architecture inside a modular monolith. See
[docs/plan-refactorizacion-hexagonal.md](docs/plan-refactorizacion-hexagonal.md) for the full plan.

```
frontend/
  server/
    modules/pets/
      domain/          Pet aggregate and its rules (pure TypeScript)
      application/     use cases and ports (interfaces)
      infrastructure/  adapters: Postgres, Cloudinary, OpenAI, HTTP presenters
    shared/            errors, actor, config, database, HTTP helpers
    container.ts       composition root: wires adapters to ports
    api/v1/            HTTP handlers (thin: validate, call a use case, present)
    db/migrations/     SQL migrations (dbmate)
  contracts/           API schemas (zod) and DTOs shared by server and browser
  composables/usePetsApi.ts  typed API client used by pages
```

`domain/` and `application/` cannot import Nuxt, h3 or infrastructure; ESLint enforces it.

Tests live next to the code they cover (`*.test.ts`). HTTP tests in `server/test/` run the real
handlers through h3 with in-memory adapters; they are kept out of `server/api/` so Nitro does not
serve them as routes.

## API

| Method | Path | Notes |
|---|---|---|
| GET | `/api/v1/pets` | Approved pets only. Filters `reportType`, `species`, `resolution`, `q`; cursor pagination (`cursor`, `limit`) |
| POST | `/api/v1/pets` | Report a pet. Images must be Cloudinary URLs uploaded through the app. Moderated automatically: `422 content_rejected`, or stored as `pending_review` (hidden) or `approved`. Rate limited |
| GET | `/api/v1/pets/:id` | Pending pets return 404 except to admins |
| PATCH | `/api/v1/pets/:id` | `{ "resolution": "reunited" }`. Admin only for now |
| DELETE | `/api/v1/pets/:id` | Admin only for now |
| POST | `/api/v1/pets/describe` | Pre-fills the form from a photo (OpenAI). Rate limited |
| POST | `/api/v1/uploads/signature` | Signed parameters to upload an image straight to Cloudinary. Rate limited |
| GET | `/api/v1/admin/pets` | Admin. Reports by `moderationStatus` (`pending_review` by default) |
| PATCH | `/api/v1/admin/pets/:id/moderation` | Admin. `{ "status": "approved" }` publishes; `"rejected"` deletes the report and its images |
| * | `/api/internal/outbox/process` | Internal token. Delivers pending domain events |
| * | `/api/internal/images/cleanup` | Internal token. Deletes uploads older than a day that no pet uses |

Errors always look like `{ "error": { "code", "message", "details" } }`; `429` responses include `Retry-After`.
Admin actions use `Authorization: Bearer $NUXT_ADMIN_TOKEN` until Google login exists; internal endpoints use
`$NUXT_INTERNAL_TOKEN` (or Vercel's `CRON_SECRET`).

## Moderation, rate limiting and background work

- **Moderation**: every report goes through the OpenAI Decisions API (`gpt-6-luna`). Clear pet reports are
  published, clearly unrelated or inappropriate ones are rejected and their images deleted, and anything
  uncertain (or any moderator failure) waits hidden for an admin. Without an OpenAI key, development approves
  everything and production sends everything to review.
- **Rate limiting**: Upstash Redis, per client IP, on report, describe and upload signature. Off without Upstash.
- **Outbox**: domain events (`pet.published`, `pet.reunited`) are stored with the change and delivered right
  after the response. A GitHub Actions workflow (`scheduled-jobs.yml`) retries every 15 minutes and cleans up
  orphan images nightly; Vercel Cron does both once a day as a fallback (Hobby plan limit).

## Running locally

```bash
cp frontend/.env.example frontend/.env   # fill in Cloudinary (and optionally OpenAI) credentials
docker compose up
```

The app runs migrations on start and is served at [localhost:8000](http://localhost:8000/).
Use `docker compose down -v && docker compose up --build` to start from a clean database.

Without Docker, from `frontend/`: start a Postgres, set `NUXT_DATABASE_URL`, then
`npm install && npm run db:migrate && npm run dev`.

## Scripts (in `frontend/`)

| Script | |
|---|---|
| `npm run dev` / `build` | Nuxt dev server / production build |
| `npm test` | Unit, HTTP and composable tests; Postgres integration tests also run when `TEST_DATABASE_URL` points to a migrated, disposable database |
| `npm run test:coverage` | Same, with coverage. Thresholds (90% lines, 85% branches) apply when `TEST_DATABASE_URL` is set, as in CI |
| `npm run lint` / `typecheck` | ESLint (including layer boundaries) / vue-tsc |
| `npm run db:migrate` / `db:rollback` / `db:new <name>` | dbmate migrations in `server/db/migrations` |

## Deployment (Vercel)

Set the `NUXT_*` variables from `frontend/.env.example` in the Vercel project (use Supabase's pooler URL for
`NUXT_DATABASE_URL`) and run `npm run db:migrate` against the production database before deploying a release
that adds migrations.

Also set `CRON_SECRET` to the same value as `NUXT_INTERNAL_TOKEN`, and in GitHub add the repository variable
`APP_URL` (e.g. `https://mascotasdana.es`) and the secret `INTERNAL_TOKEN` for the scheduled workflow.
