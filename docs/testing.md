# Testing and quality gates

Run commands from the repository root unless noted. The tests use stubs and
mocked HTTP; a running backend, GitHub PAT, or network GitHub access is not
required for unit tests. Installation and restore require registry access.

## Backend

```powershell
dotnet restore GitHubRepositoryMonitor.sln
dotnet build GitHubRepositoryMonitor.sln -c Release --no-restore
dotnet test GitHubRepositoryMonitor.sln -c Release --no-build --no-restore
dotnet format GitHubRepositoryMonitor.sln --verify-no-changes --no-restore
```

The solution contains six source projects and three xUnit test projects.
The current executed counts (2026-10-26) are also recorded in the
[delivery record](delivery-checklist.md).

| Suite          | Cases | Coverage                                                                                                             |
| -------------- | ----- | -------------------------------------------------------------------------------------------------------------------- |
| Infrastructure | 25    | Provider mapping/errors, rate-limit classification, headers, ten-item limit, deadlines/cancellation, defensive cache |
| Wcf.Host       | 4     | Sync success, failure/timeout preserving cache and timestamp, shutdown cancellation                                  |
| API            | 13    | Controller contracts/cancellation; SOAP/REST error and rate-limit tests; fault metadata; cache-only SOAP reads       |

New focused provider tests cover deadlines before headers and during a stalled
body, explicit caller cancellation, and more/fewer-than-ten results. Job tests
preserve the last successful snapshot and timestamp after failure or timeout.
API integration tests start test-only loopback CoreWCF and REST hosts, use a
fake HTTP upstream, and call the actual System.ServiceModel client. They assert
the deserialized fault code and REST envelope for authentication (502) and
timeout (504), plus unexpected failure (500), WCF unavailable (503), and cached
SOAP retrieval without a GitHub call. No production failure-simulation endpoint
or real GitHub token is used. The fake body stalls until its test cancellation
deadline; tests have short bounded waits rather than production-length delays.
Matching fault/data contract name, namespace and action are checked explicitly.
BasicHttpBinding uses SOAP 1.1 without a WS-Addressing action header, so the
received client fault's `Action` is null; the tests preserve this observed
protocol behavior rather than claiming a wire header was present.

The rate-limit regressions verify HTTP 403 with `X-RateLimit-Remaining: 0` and
HTTP 429 become `RateLimited`, while an ordinary HTTP 403 becomes `AccessDenied`.
The provider's typed `GitHubRateLimitException` preserves the original HTTP
status; the service maps its type rather than matching exception messages.
Real SOAP/REST tests assert the fault code and distinct safe REST messages.

These tests do not exercise actual private GitHub, verify wall-clock Quartz
timing, or stress concurrent cache access. For CI-equivalent Release verification:

```powershell
dotnet build GitHubRepositoryMonitor.sln --configuration Release --no-restore
dotnet test GitHubRepositoryMonitor.sln --configuration Release --no-build --no-restore
```

## Frontend

```powershell
Set-Location frontend
npm ci
npm run build
npm test -- --watch=false
npm test -- --watch=false --configuration production
npx tsc -p tsconfig.app.json --noEmit --noUnusedLocals --noUnusedParameters
npx tsc -p tsconfig.spec.json --noEmit --noUnusedLocals --noUnusedParameters
npx prettier . --check
npx prettier ../.github/workflows/frontend-ci.yml --check --end-of-line lf
npx prettier ../.github/workflows/backend-ci.yml --check --end-of-line lf
```

`npm run build` is the production build. Development tests exclude
`*.production.spec.ts`; the production test configuration includes only
`src/app/app.config*.spec.ts`, validating real API selection without the mock
environment replacement. It is a focused suite, not the entire test suite run in
production mode. Vitest/jsdom tests cover service behavior, dashboard state, and
component interactions; they do not replace a real browser test.

The initial production bundle warning does not fail the build unless the error
budget is exceeded. This checkpoint does not raise budgets. A successful build
does not independently prove Telerik license activation.

Inspect running project processes before a clean install. If an unidentified
Sass process locks the original Windows folder, leave it running and verify
`npm ci` in an isolated copy of the current source with the same lockfile.
Activate the existing user-level license there; never copy the key into the
repository. Record the original-folder failure and isolated success separately.
Do not change dependencies or the lockfile to work around the lock.

## Documentation and diff checks

From the repository root, reuse the installed frontend Prettier and check
Markdown without changing application code:

```powershell
frontend/node_modules/.bin/prettier.cmd README.md "docs/**/*.md" frontend/README.md --check
npx --yes markdownlint-cli2 README.md "docs/**/*.md" frontend/README.md
git diff --check
git diff --cached --check
git diff --stat
git diff --cached --stat
git status --short
```

The Markdown linter is optional tooling, not a declared dependency. Check local
relative links against files and headings. If a Mermaid parser is available,
parse the fenced diagram in the root README; report parser unavailability
instead of calling visual inspection a syntax pass.

## Manual reviewer checks

1. Start services using the [quick start](../README.md#quick-start-powershell).
2. Request both REST routes and compare the `success`, `message`, and `data`
   structure against the README. Verify SOAP metadata at the documented path.
3. Observe both Kendo Grids in API mode. Exercise the refresh buttons and
   inspect the displayed synchronization time.
4. Read `/api/github/scheduled` twice more than a minute apart. On successful
   sync, `lastSyncTime` advances; this does not require a new repository commit.
5. Use mock scenarios for reproducible loading, empty, unsynchronized, and error
   states. Separately check desktop, 375px and the additional 320px viewport:
   page overflow, grid scrolling, long messages/full SHA, buttons, error dialog,
   keyboard focus containment, Escape and focus restoration. Browser fixtures
   that intercept API responses prove UI behavior, not private-GitHub access.

The [delivery checklist](delivery-checklist.md) separates user-supplied
historical evidence, checks rerun during this audit, and items still unverified.
Successful CI is recorded independently from local execution and licensing
status.
