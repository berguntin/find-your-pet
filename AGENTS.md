# Lost and found pets finder

Lost and found pets board (it started with the DANA floods in Valencia). People post reports and search them in two ways: by text with semantic search ("perro negro" finds black dogs even if the report doesn't say so) and by photo (pets that look like an image).

API, environment variables and deployment details: [README.md](README.md). Decisions and plans: [docs/](docs/).

## Stack
- **A single Nuxt 3 app** in `frontend/`: it serves both the UI and the API (`server/api/v1`, Nitro). There is no separate backend (the old Express one is gone).
- **Postgres 17 + pgvector** (HNSW). SQL migrations with dbmate in `server/db/migrations`. `postgres` driver (no ORM).
- **Search**: Gemini Embedding 2 (multimodal, 768 dims). Text and photos share one vector space, so a text query is also compared against photos.
- **OpenAI**: report moderation (Decisions API, `gpt-6-luna`) and form pre-fill from the photo (`describe`).
- **Images**: Cloudinary. The browser uploads directly with a server-generated signature (Vercel has a 4.5 MB request limit); the server only receives URLs.
- **Rate limiting**: Upstash Redis. **Deployment**: Vercel (Hobby) + Supabase. Scheduled jobs on GitHub Actions (`scheduled-jobs.yml`), with Vercel Cron as a fallback.
- UI: Tailwind + daisyUI, `@nuxtjs/i18n` (`es` only), `@nuxt/content` for legal pages. Validation with zod.
- Node 24, **npm** (not pnpm).

## Commands (from `frontend/`)
- `npm run dev` · `npm run lint` · `npm run typecheck` · `npm test` · `npm run build`
- `npm run test:coverage`: what CI runs. Thresholds (90% lines, 85% branches) apply only when `TEST_DATABASE_URL` points to a migrated, disposable database; without it the Postgres tests are skipped.
- `npm run db:migrate` · `db:rollback` · `db:new <name>`
- `npm run eval:embeddings -- <dataset-dir>`: measures the model on labelled photos and suggests the calibration.
- `npm run reindex:search`: re-embeds everything after a model change.
- Full environment: `docker compose up` from the repo root (app on localhost:8000, migrates on start).

CI (`.github/workflows/ci.yml`) runs: lint → typecheck → migrate → test:coverage → build. Anything that doesn't pass that is not done.

## Architecture (hexagonal, modular monolith)
```
frontend/server/
  modules/pets/domain/          Pet aggregate and pure rules (moderation, matchScore)
  modules/pets/application/     use cases and ports (interfaces)
  modules/pets/infrastructure/  adapters: Postgres, Cloudinary, Gemini, OpenAI, HTTP presenters
  shared/                       errors, actor, config, outbox, rate limit
  container.ts                  composition root: the only place that picks adapters
  api/v1/                       thin handlers: validate → use case → presenter
frontend/contracts/             zod schemas and DTOs shared with the browser
frontend/composables/usePetsApi.ts  typed client used by pages
```
- `domain/` and `application/` are plain TypeScript: no Nuxt/h3/auto-imports (`useRuntimeConfig`, `readBody`…), no `postgres`, `cloudinary`, `openai`, and no `infrastructure/` or `contracts/`. ESLint enforces it; don't disable it, add a port.
- `contracts/` only imports zod and domain values (it is bundled into the browser).
- Every external adapter has an in-memory/disabled version (`InMemory*`, `Fake*`, `Disabled*`, `Unavailable*`). Without a key, features degrade instead of breaking: without Gemini, photo search returns 503 and `q` is keyword-only; without OpenAI, development approves everything and production sends everything to review.
- Side effects (embedding indexing, future notifications) go through the **outbox**: the event is stored with the change and processed after the response. Don't put slow external API calls on the report path.
- HTTP errors always look like `{ "error": { "code", "message", "details" } }`; `429` includes `Retry-After`.
- Admin: `Authorization: Bearer $NUXT_ADMIN_TOKEN` (until Google login exists). Internal endpoints: `$NUXT_INTERNAL_TOKEN` / `CRON_SECRET`.
- Database: every schema change is a new migration; never edit one that has already been applied.

## Product rules
- A report is "lost" or "found"; search crosses both types (a lost pet can match a found one).
- Photo and semantic results are suggestions, not certainties: the UI shows approximate matches (calibrated percentage) and never claims "this is your pet".
- Only `approved` reports are shown. `pending_review` stays hidden (404 except for admins); `rejected` is not stored and its images are deleted.
- Keyword hits (names, phone numbers, towns) come before semantic ones.

## Search: how to change it
- Any change to the model, thresholds or indexed text is validated with data, not by eye:
  - ranking and calibration logic: tests in `application/search.test.ts` and `domain/matchScore.test.ts`;
  - model quality on photos: `npm run eval:embeddings` on a local labelled dataset (`frontend/dataset/`, git-ignored because it contains real photos).
- Calibration lives in the `NUXT_IMAGE_SEARCH_*` and `NUXT_SEMANTIC_SEARCH_*` variables (floor/ceiling). The text ones are provisional.
- Never compare vectors from different models (the index stores the model). After changing the model: `npm run reindex:search`.

## Privacy and security (critical)
- Photos: strip EXIF metadata (including geolocation) before storing them. Validate type (jpg, png, webp, heic) and size; only URLs from our own Cloudinary are accepted (`ImageStorage.isManagedUrl`).
- The photo used for image search is never stored.
- Contact: phone and email are not publicly exposed by default.
- Location with limited precision: an area, not the exact home address.
- Minimal personal data and **never in logs** (no contact details, no plain IPs, no request bodies). GDPR compliant; the policy lives in `content/politica-de-privacidad.md` and must reflect any new data collected or external service it is sent to.
- Always escape report text: no `v-html` with user content.
- Rate limit every endpoint that costs money or writes (report, describe, upload signature, photo search).
- Think about abuse: fake reports, "reward" scams and spam. Automatic moderation alone is not enough.

## Code rules
- Strict TypeScript, no `any` (nor `as any`). Validate external input with zod at the edge.
- Tests next to the code (`*.test.ts`). HTTP tests in `server/test/` with in-memory adapters (outside `server/api/` so Nitro doesn't serve them as routes). Postgres adapters have integration tests.
- Prettier: 4 spaces, single quotes, no semicolons, 120 columns.
- Basic accessibility in forms, lists and images (descriptive `alt`).
- Mobile first: most people will upload the photo from their phone.
- UI text in Spanish via i18n.

## Workflow
- Reply to the user in Spanish; code, variable names, comments and commits in English.
- Conventional Commits (`feat:`, `fix:`, `docs:`…), on `feat/…` / `fix/…` branches with a PR to `main`.
- Before calling something done: `npm run lint && npm run typecheck && npm test` (plus `npm run build` if you touch Nuxt config or routes).
- If the change touches photo uploads, personal data or contact details, explicitly review it against the privacy section; if it touches search, against the search section.
- Don't edit `.env` or commit secrets. Hugo manages secrets; if a new variable is needed, add it to `.env.example` with a comment and to `server/shared/infrastructure/config.ts`.
- When adding a feature or endpoint, update the API table in the README.

## Known current state (debt, don't assume it already complies)
- Contact (`contact`) is returned in the public report DTO: it breaks the rule about not exposing contact details.
- Location is free text: nothing prevents typing an exact address.
- EXIF: `pages/registrar` resizes in the browser before uploading (`utils/images.ts` re-encodes on a canvas, which strips it), but the server doesn't guarantee it: a direct upload to Cloudinary with the signature would keep the metadata.
