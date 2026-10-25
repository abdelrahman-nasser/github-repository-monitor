# GitHub Repository Monitor frontend

Angular 22 dashboard using standalone components, Signals, TypeScript 6, SCSS,
and Kendo UI Grid, Dialog, and Buttons. See the [root README](../README.md) for
architecture and backend endpoints, [setup guide](../docs/setup.md) for service
startup and licensing, and [testing guide](../docs/testing.md) for quality
gates.

## Run locally

Use Node.js 24.15 or later in the Node 24 family and npm 11.19.0. From the
repository root in PowerShell:

```powershell
cd frontend
npm ci
```

Activate a valid Telerik trial or commercial license using the
[setup guide](../docs/setup.md#kendo-ui-license) before running the dashboard or
building it. Keep the personal license file outside the repository. The current
license used for prior local verification is a time-limited trial; CI activation
requires separate setup.

Choose a mode:

| Command                                        | Behavior                                                    |
| ---------------------------------------------- | ----------------------------------------------------------- |
| `npm start`                                    | Development with mock data; no backend required.            |
| `npm start -- --configuration development-api` | Development with the real REST API through the local proxy. |
| `npm run build`                                | Production build using the real REST API.                   |
| `npm run build -- --configuration development` | Development build using mock data.                          |

Open [http://localhost:4200](http://localhost:4200) after starting the
development server. For API mode, start the CoreWCF host and REST API first
using the setup guide. `src/proxy.conf.json` forwards `/api/**` to
`http://localhost:5203`.

Production calls relative `/api/github/live` and `/api/github/scheduled`
endpoints. Configure production hosting to route `/api` to the REST API and
serve the Angular application. The development proxy is not included in the
production bundle. No GitHub credentials belong in frontend configuration.

## Mock configuration

`src/environments/environment.development.ts` selects mock mode with
`mockScenario: 'success'`. Edit its `githubApi` configuration to select a
scenario or set `mockDelayMs` (600 milliseconds by default). Only the
`development` build replaces the base environment; `development-api` and
production use the base API configuration.

| `mockScenario` | Result                                                                     |
| -------------- | -------------------------------------------------------------------------- |
| `success`      | Sample commits in both grids and a fixed sample synchronization timestamp. |
| `empty`        | Empty grids with a successful snapshot timestamp.                          |
| `unsynced`     | Sample live commits; empty scheduled snapshot with no timestamp.           |
| `failure`      | Simulated HTTP service errors.                                             |
| `timeout`      | Requests time out after 25 seconds, as real HTTP requests do.              |
| `unavailable`  | Simulated connection failures.                                             |

Mock mode sends no HTTP requests. Fixtures in
`src/app/core/mocks/mock-commits.ts` contain synthetic demonstration data. API
mode validates the `{ success, message, data }` response and commit fields;
errors do not switch the application to mock data.

## Dashboard behavior

- Both sections load independently when the dashboard opens. **Refresh Live Data**
  fetches current GitHub commits; **Refresh snapshot** reads the backend's
  cached commits.
- There is no frontend polling timer. The displayed 60-second interval describes
  the backend scheduler; use **Refresh snapshot** to display its latest result.
- Kendo Grids show the message, author, date, SHA, and source, with resizable
  columns, keyboard navigation, and horizontally scrollable regions. SHA
  disclosures expose the full identifier.
- Kendo Buttons disable each refresh while its request is pending. Loading
  indicators, successful empty results, unsynchronized snapshots, and errors
  have distinct states.
- Kendo Dialog displays request errors and restores focus when dismissed. A
  failed refresh keeps the last successful rows and synchronization timestamp
  visible with an error notice.
- Dates and `LastSyncTime` display in the browser's local time zone. Mock
  timestamps are labeled as sample data.

The lazy dashboard route is in `src/app/app.routes.ts`. Data access and
validation live in `src/app/core/services/github-api.service.ts`; feature state
lives in `src/app/features/github-monitor/`; reusable grids, dialog, and models
are under the feature and shared directories.

## Verification

From `frontend/`:

```powershell
npm run build
npm test -- --watch=false
npm test -- --watch=false --configuration production
npx tsc -p tsconfig.app.json --noEmit --noUnusedLocals --noUnusedParameters
npx tsc -p tsconfig.spec.json --noEmit --noUnusedLocals --noUnusedParameters
npx prettier . --check
npx prettier ../.github/workflows/frontend-ci.yml --check --end-of-line lf
```

The default Vitest suite uses Angular TestBed and jsdom; the focused production
suite verifies API configuration. Tests use fake providers and HTTP testing
utilities and need no backend or GitHub token. No standalone end-to-end runner
or lint script is configured. Browser layout and keyboard checks remain separate
from unit tests.

Frontend CI runs dependency installation, trusted-context license activation,
the production build, both test
configurations, strict app and spec TypeScript checks, and frontend/workflow
formatting checks. The activation step receives `TELERIK_LICENSE` only for
trusted builds. Missing secrets and fork/Dependabot PRs explicitly report
unlicensed execution while build/tests continue. Manual secret provisioning
and hosted licensed execution remain unverified; see the setup guide.

See the [delivery checklist](../docs/delivery-checklist.md) for recorded
results, prior browser evidence, bundle warnings, and remaining verification
limits.
