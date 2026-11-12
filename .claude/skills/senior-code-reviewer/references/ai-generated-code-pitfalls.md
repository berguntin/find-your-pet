# Typical pitfalls in agent-generated code

These are the mistakes agents make most often, and that another agent with the same context usually misses because it shares the same assumption. Check them explicitly, one by one.

## APIs and dependencies

- Methods, options, props or events that do not exist in the installed version. Verify in `node_modules/<package>/package.json` (version) and in its `.d.ts` types.
- Imports of packages not listed in `package.json`, or of internal paths that do not exist.
- Use of an API from a different major version (v2 syntax in a v3 project, or vice versa).
- New dependencies added unnecessarily when the repo already had an equivalent.

## Incomplete or faked implementation

- `TODO`, `FIXME`, `throw new Error('Not implemented')`, functions that return sample data or fixed values.
- Branches that only log the error to the console and carry on as if nothing happened.
- Logic that solves exactly the test cases and nothing more (hardcoded values that match the fixtures).
- Part of the requirement implemented and the rest silently dropped.

## Misleading tests

- Weakened assertions: `toBeDefined()` or `toBeTruthy()` where a concrete value should be checked.
- Skipped or focused tests (`.skip`, `.only`, `xit`), or tests deleted in the diff.
- Mocks that reimplement the logic under test, so the test ends up testing itself.
- Snapshots regenerated without checking that the change is the expected one.
- Expectations in an existing test changed to fit the new behavior without the requirement asking for it.
- Tests that cannot fail (missing `await` in async code, a `try/catch` that swallows the assertion).

## Lowering the defenses so everything passes

- `as any`, `as unknown as T`, non-null `!`, `@ts-ignore`, `@ts-expect-error` without a real reason.
- `eslint-disable`, rules turned off in the config, `strict` relaxed in `tsconfig`.
- Coverage thresholds lowered, CI steps removed or marked as allowed to fail.
- Empty `catch {}` or a generic `catch` that turns any failure into a default value.

## Ignoring the repository's context

- Duplicated helpers, composables or utilities when an equivalent already existed.
- Conventions different from the surrounding code (naming, folder structure, error handling, API response format).
- A shared function's signature changed without updating all its callers.
- Required config files, environment variables or migrations not added.

## Edge cases that are systematically forgotten

- Empty collections, `null`/`undefined`, empty strings, negative numbers or zero, duplicate values.
- Pagination: last page, out-of-range page.
- Dates: time zones, daylight saving changes, end of month, locale formatting.
- Concurrency: double clicks, simultaneous requests, race conditions between read and write.
- Network: timeouts, retries, partial responses or unexpected formats.
- Permissions: logged-out user, user from another tenant, resources owned by someone else.

## Security

- User input used unvalidated in queries, file paths, commands or HTML.
- Authorization checked only on the client.
- Secrets or keys in code, in logs or sent to the client.
- CORS, cookies or headers configured permissively "to make it work".

## Signals in the diff itself

- A diff much larger than the requirement justifies: it often hides unrequested changes.
- Modified files unrelated to the task.
- Lockfile changes without `package.json` changes, or vice versa.
- Comments describing what the code "does" that do not match what it actually does.
