# GitHub Repository Monitor frontend

Native Angular 22 dashboard built with standalone components, TypeScript 6, Signals, SCSS, Angular Router, and Vitest. Development defaults to mock mode and works without the .NET backend; production defaults to the real API. No UI framework or Kendo package is installed.

## Run locally

Use Node.js 24 and npm 11. From PowerShell:

```powershell
cd D:\Dev\GitHubRepositoryMonitor\frontend
npm ci
npm start
```

Open [http://localhost:4200](http://localhost:4200). Both sections load automatically. **Refresh live** retrieves live commits again; **Refresh snapshot** reads the scheduled cache again. There is no frontend polling timer. The displayed 60-second interval describes the backend scheduler; mock mode uses fixed sample snapshots.

## Mock and API configuration

Angular build configurations select the API mode through `src/environments/environment.ts`, which `app.config.ts` provides to `GithubApiService`:

| Command                                        | Configuration     | API mode                                      |
| ---------------------------------------------- | ----------------- | --------------------------------------------- |
| `npm start`                                    | `development`     | Mock success by default; no backend required. |
| `npm start -- --configuration development-api` | `development-api` | Real API through the development proxy.       |
| `npm run build`                                | `production`      | Real API using relative `/api` endpoints.     |
| `npm run build -- --configuration development` | `development`     | Mock mode for an offline development build.   |

The base `src/environments/environment.ts` selects API mode. The `development` build replaces it with `src/environments/environment.development.ts`, whose default configuration is:

```typescript
import type { GithubApiConfig } from '../app/core/services/github-api.service';

export const environment = {
  production: false,
  githubApi: { mode: 'mock', mockScenario: 'success' } satisfies GithubApiConfig,
};
```

Edit `githubApi` in `src/environments/environment.development.ts` to choose an offline scenario or adjust its delay. The development API configuration uses the base environment, so these mock settings do not affect it or production.

| Setting                       | Behavior                                                                                   |
| ----------------------------- | ------------------------------------------------------------------------------------------ |
| `mockScenario: 'success'`     | Sample commits in both sections and a fixed sample synchronization timestamp.              |
| `mockScenario: 'empty'`       | Empty live results and a successfully synchronized empty snapshot with a valid timestamp.  |
| `mockScenario: 'unsynced'`    | Sample live commits and an empty scheduled cache with no synchronization timestamp.        |
| `mockScenario: 'failure'`     | Both requests fail with a simulated HTTP service error.                                    |
| `mockScenario: 'timeout'`     | Both requests time out after 15 seconds with the same message as a real timed-out request. |
| `mockScenario: 'unavailable'` | Both requests fail with the same connection message as an unavailable backend.             |
| `mockDelayMs: 600`            | Delay in milliseconds for scenarios other than timeout; 600 is the default.                |

Fixtures live in `src/app/core/mocks/mock-commits.ts`, independent of feature components. Commit identifiers, messages, authors, dates, and the last synchronization timestamp are synthetic demonstration values. Mock mode sends no HTTP requests.

To intentionally test against a local backend, start that backend separately and run:

```powershell
npm start -- --configuration development-api
```

`provideHttpClient()` is already registered. `GithubApiService` calls `GET /api/github/live` and `GET /api/github/scheduled`; `angular.json` enables `src/proxy.conf.json` for the development server, forwarding `/api/**` to `http://localhost:5203`. For a deployed frontend, configure its hosting server to forward `/api` to the backend; the development proxy is not part of the production bundle. Production HTTP requests contain no hardcoded localhost address.

The service unwraps the typed `{ success, message, data }` response, validates commit data and synchronization timestamps, and surfaces failed responses, HTTP errors, and request timeouts. API mode never silently falls back to mock data. No GitHub credentials belong in the frontend.

## Structure and behavior

- `core/services/github-api.service.ts`: configurable mock/HTTP access, response validation, and error interpretation. Mock timers and HTTP requests support cancellation.
- `core/mocks/mock-commits.ts`: synthetic demonstration fixtures shared by the service and tests.
- `src/environments/`: build-selected API configuration; production and explicit backend development use the API by default.
- `shared/models/`: commit, API envelope, and scheduled snapshot models compatible with the REST API.
- `features/github-monitor/github-monitor.*`: local Signal state, independent loading/error states, guarded refresh actions, and subscriptions cancelled on destruction.
- `features/github-monitor/components/commit-table/`: presentation-only native table shared by both sections. Narrow screens use keyboard-focusable horizontal scroll regions; commit messages wrap and native SHA disclosures expose the full identifier.
- `shared/components/error-dialog/`: reusable native modal dialog with a required message, Close and Escape handling, accessible labels, background interaction blocking, and focus management.
- `app.routes.ts`: lazy dashboard route and fallback routing.

Components use `OnPush` and Angular's native template control flow. Refresh failures keep the previous successful data visible and explain that it may be stale. Empty results and an unsynchronized cache have distinct states. Dates display in the browser's local time zone.

## Verification

Run from `frontend/`:

```powershell
npm run build
npm test -- --watch=false
npm test -- --watch=false --configuration production
npx tsc --project tsconfig.app.json --noEmit --noUnusedLocals --noUnusedParameters
npx tsc --project tsconfig.spec.json --noEmit --noUnusedLocals --noUnusedParameters
npx prettier . --check
npx prettier ../.github/workflows/frontend-ci.yml --check
```

The production build writes to `dist/`. The focused production test uses the production build configuration to verify real API mode; the default test run uses the development configuration. TypeScript checks apply the project's strict settings to app and test code and also reject unused locals and parameters. Vitest uses Angular TestBed and jsdom, with fake data providers and HTTP testing utilities; tests need no backend connectivity. Native dialog unit tests model the browser dialog API because jsdom has no modal top layer. Browser checks are still useful for visual layout and actual keyboard behavior.

No standalone end-to-end runner or lint script is configured. Prettier configuration is in `.prettierrc`.

## Frontend CI

`.github/workflows/frontend-ci.yml` runs independently of Backend CI on pushes and pull requests that change `frontend/**` or the frontend workflow itself. It uses the GitHub-hosted `ubuntu-latest` runner, Node.js 24, and npm's download cache keyed by `frontend/package-lock.json`.

All command steps run from `frontend/`: `npm ci`, the production build, Angular tests without watch mode, the focused production API mode test, strict TypeScript and unused-code checks, and Prettier checks for the frontend and workflow. Tests use mocks and HTTP testing utilities, so CI needs neither a running backend nor a GitHub API token.

## Next integration steps

When the backend can run, opt in to API mode and verify both endpoints through the development proxy: successful responses, an unsynchronized cache, synchronization timestamps, refreshes, and service errors. Keep mock scenarios available for offline frontend work.

After real API verification, migrate the native commit table and error dialog presentation to the required Kendo Grid and Kendo Dialog. Preserve the existing data service, models, and dashboard state. Kendo installation, licensing, and themes are outside this native implementation.
