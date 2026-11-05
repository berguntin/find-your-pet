@../AGENTS.md

## Claude Code specifics
- Before calling something done, run `/verify` (lint, typecheck, tests and build as in CI). If anything fails, it is not done.
- Before committing, run the `reviewer` subagent on the diff.
- If the change touches photo uploads, personal data, contact details, location or logs, also run `privacy-reviewer`. If it touches search, embeddings or calibration, run `search-reviewer`. Fix blocking findings before committing.
- `.claude/launch.json` has dev server configurations for the built-in browser preview.
