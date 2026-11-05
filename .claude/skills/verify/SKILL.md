---
name: verify
description: Runs the same checks as CI (lint, typecheck, tests, build) in frontend/ and summarizes what fails. Use it before calling any change done.
allowed-tools: Bash(npm run *), Bash(npm test*), Bash(git status*), Bash(git diff*)
---

# Verify

Checks that the current change would pass CI (`.github/workflows/ci.yml`). Everything runs from `frontend/`.

## Steps

1. See what changed: `git status --short` and `git diff --stat` (including staged changes). If nothing changed, say so and stop.
2. Run these in order, **without stopping at the first failure** (so every problem shows up at once):
   - `npm run lint`
   - `npm run typecheck`
   - Tests:
     - If `TEST_DATABASE_URL` is set: `npm run test:coverage` (applies the CI thresholds: 90% lines, 85% branches).
     - Otherwise: `npm test`, and warn that the Postgres integration tests and the coverage thresholds were **not** checked.
   - `npm run build` only if the diff touches `nuxt.config.ts`, `package.json`, `server/api/`, `pages/`, `layouts/`, `app.vue`, `i18n.config.ts` or `tailwind.config.js`.
3. If there are new migrations in `server/db/migrations/`, check that no existing one was modified (`git diff --name-status` on that folder: only `A`, never `M` or `D`).
4. Check the diff (added lines only) for:
   - Explicit `any` (`: any`, `as any`, `<any>`).
   - New `v-html`.
   - `console.log` or `consola.*` printing contact details, email, phone, IP or request bodies.
   - Changes to `.env` (never edited).
   - New `NUXT_*` variables missing from `.env.example`.

## Report

Reply in Spanish. A short table with each check and its result (✅ / ❌ / ⏭️ skipped and why). Below it, for each ❌, the relevant error (file:line and message, without dumping the whole log). Don't fix anything unless asked: only report.

Don't call the change done if there is any ❌.
