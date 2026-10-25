# Configuration and setup

Use the [root quick start](../README.md#quick-start-powershell) for commands to
start all three processes. This page explains configuration and licensing.

## Backend configuration

ASP.NET Core's standard providers apply: base `appsettings.json`, environment
settings, process environment variables, then command-line overrides. The
documented `http` launch profiles set `ASPNETCORE_ENVIRONMENT=Development`.
There is no configured UserSecretsId or automatic `.env` loader.

| Process      | Key                                     | Checked-in Development value / behavior                                            |
| ------------ | --------------------------------------- | ---------------------------------------------------------------------------------- |
| CoreWCF Host | `GitHub:Owner`                          | `abdelrahman-nasser`; required nonblank                                            |
| CoreWCF Host | `GitHub:Repository`                     | `github-repository-monitor`; required nonblank                                     |
| CoreWCF Host | `GitHub:Branch`                         | `develop`; explicitly set the actual selected repository branch in PowerShell      |
| CoreWCF Host | `GitHub:Token`                          | Not stored; required nonblank                                                      |
| CoreWCF Host | `GitHub:RequestTimeout`                 | `00:00:15` default; positive TimeSpan, at most 15 seconds                          |
| API          | `Wcf:EndpointUrl`                       | `http://localhost:5101/GitHubMonitorService.svc`; required absolute HTTP/HTTPS URL |
| Both         | `Logging:LogLevel:Default`              | `Information`                                                                      |
| Both         | `Logging:LogLevel:Microsoft.AspNetCore` | `Warning`                                                                          |
| Both         | `AllowedHosts`                          | `*` in base settings                                                               |

Required GitHub fields and the WCF URL are validated at startup. Syntactically
valid configuration does not prove repository access or service availability.
The base settings do not provide GitHub or WCF connection settings; when running
outside Development, provision those keys explicitly.

Set configuration in the **host terminal** before starting it:

```powershell
$env:GitHub__Owner = 'YOUR_OWNER'
$env:GitHub__Repository = 'YOUR_REPOSITORY'
$env:GitHub__Branch = Read-Host 'Actual GitHub branch name'
if ([string]::IsNullOrWhiteSpace($env:GitHub__Branch)) {
    throw 'Enter the actual branch name before starting the host.'
}
$env:GitHub__Token = [System.Net.NetworkCredential]::new('', (Read-Host 'GitHub PAT' -AsSecureString)).Password
```

The PDF's assigned endpoint is
`GET https://api.github.com/repos/company/integration-task-private-repo/commits`.
Use owner `company` and repository `integration-task-private-repo` when employer
access is supplied, and enter its actual branch name. Employer access remains
unverified. The alternative demonstration repository
`abdelrahman-nasser/github-repository-monitor` is **VERIFIED for direct
authenticated GitHub REST access**, based on the new human-supplied results:
`private: true`, branch `feature/github-integration`, 10 commits returned, and
authenticated read passed. To reproduce that demo check, explicitly select that
owner/repository and enter `feature/github-integration`; the checked-in branch
default remains `develop`. Repository selection has not been changed.

This evidence is a direct GitHub API check, not a new application end-to-end
run, and does not independently establish read-only token scope. See the
[human-run evidence](delivery-checklist.md#human-run-direct-github-rest-verification).
A public demonstration cannot establish private-repository access, and the
alternative private demo does not verify access to the employer's repository.

Do not use `$env:GitHub__Branch = ''` to request GitHub's default branch in
Windows PowerShell 5.1: it removes the environment variable and leaves
`appsettings.Development.json`'s `develop` value effective. An absent or empty
effective Branch makes the provider omit `sha`, but removing only the
environment override does not clear a lower-priority configured value. The
quick start therefore requires an explicit branch name. See Microsoft's
[environment-variable guidance](https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.core/about/about_environment_variables?view=powershell-7.4).

Use the root quick start's `try/finally` to clear the token when the host exits.
The PAT must stay in server-side configuration. Never paste it into source,
Angular environments, URLs, committed settings, or a shell command literal. The
application sends it to GitHub only in the Bearer authorization header over
HTTPS. The provider requests `/repos/{owner}/{repository}/commits?per_page=10`
and adds `&sha={branch}` when a branch is configured. No pagination or immediate
retry policy is implemented. The provider owns one 15-second deadline covering
request headers and body deserialization; the HTTP client has no competing
timeout. Caller/request cancellation and Quartz shutdown cancellation retain
their cancellation semantics rather than becoming upstream timeouts.

For an API connection override, set this in the **API terminal**:

```powershell
$env:Wcf__EndpointUrl = 'http://localhost:5101/GitHubMonitorService.svc'
```

The scheduler's one-minute interval, cache limit of 10, GitHub base URL, and
SOAP client timeouts are source constants, not configuration keys. SOAP client
open/send/close timeouts are 5/20/5 seconds.

## Addresses and host profiles

| Service   | Documented local address | Source of setting                                         |
| --------- | ------------------------ | --------------------------------------------------------- |
| SOAP host | `http://localhost:5101`  | Host `http` launch profile and explicit `--urls`          |
| REST API  | `http://localhost:5203`  | Explicit `--urls`; API `http` profile otherwise uses 5080 |
| Angular   | `http://localhost:4200`  | Explicit `--host localhost --port 4200`                   |

The host exposes `/health`, `/GitHubMonitorService.svc`, and HTTP WSDL at
`/GitHubMonitorService.svc?wsdl`. Development additionally exposes
`/diagnostics/github` (direct live retrieval) and `/diagnostics/scheduled`
(cache count and timestamp). The API exposes Swagger and `/api/diagnostics/wcf`
only in Development.

Both backend processes are intended for local review with these settings. There
is no caller authentication. BasicHttpBinding uses its default unsecured mode;
accepting an HTTPS URL in options does not configure transport security. The API
includes HTTPS redirection middleware, but the HTTP-only profile does not
configure an HTTPS listener. External deployment needs deliberate transport and
access-control configuration; it is outside this checkpoint.

## Angular modes

| Command from `frontend`                        | Environment                  | Behavior                              |
| ---------------------------------------------- | ---------------------------- | ------------------------------------- |
| `npm start`                                    | `environment.development.ts` | Offline mocks                         |
| `npm start -- --configuration development-api` | `environment.ts`             | Real API via development proxy        |
| `npm run build`                                | `environment.ts`             | Production, real relative `/api` URLs |
| `npm run build -- --configuration development` | `environment.development.ts` | Development mock build                |

`environment.githubApi.mode` selects `mock` or `api`; `mockScenario` and
`mockDelayMs` configure mocks. The base environment selects `mode: 'api'`; the
service uses the fixed relative `/api/github/live` and `/api/github/scheduled`
paths, with no configurable base URL property. The development proxy in
`frontend/src/proxy.conf.json` targets `http://localhost:5203`. Angular contains
no token. Production hosting must route `/api` to the REST service; the
development proxy is not a deployment artifact. See the
[frontend guide](../frontend/README.md) for UI and mock behavior.

## Kendo UI license

Both trial and commercial use require activation. The project already includes
the licensing package; after `npm ci`, use:

```powershell
npx kendo-ui-license refresh
npx kendo-ui-license activate
```

The refresh command opens a browser for Telerik sign-in. On Windows the current
user-level key location is `%APPDATA%\Telerik\telerik-license.txt`. If the key
is already current, skip refresh. Obtain a new valid key when the time-limited
trial expires. Keep license material outside this repository. Narrow ignore
rules protect Telerik/Kendo license text filenames and local secret variants;
normal Development settings and Angular environments remain reviewable. See
[official activation guidance](https://www.telerik.com/kendo-angular-ui/components/licensing).

## CI licensing setup

The [frontend workflow](../.github/workflows/frontend-ci.yml) activates the
installed licensing CLI **after `npm ci` and before build/tests**, with the
`TELERIK_LICENSE` secret exposed only to that step. A trusted execution with a
key runs `npx kendo-ui-license activate`; a missing key produces an explicit
warning and still runs all build/test checks. Fork and Dependabot pull requests
skip secret activation and explicitly report unlicensed execution. The workflow
uses `pull_request`, with no `pull_request_target` secret exposure.

Manual GitHub secret setup is required; its existence was not assumed or
queried. Current Telerik guidance recommends a deployment key for new CI
pipelines; developer keys remain accepted. Provision a key appropriate to the
account's entitlement; deployment-key availability is not assumed for a trial
account. Provisioning the Actions secret and a hosted licensed run remain
manual, unverified prerequisites. Build success alone does not establish
licensing. Do not print key values. See
[official CI licensing guidance](https://www.telerik.com/kendo-angular-ui/components/licensing/ci-services).

## Local verification issues

Close the repository's Angular development server before running `npm ci` in
that same folder on Windows: the embedded Sass executable can lock files under
`node_modules`. This audit encountered that lock and used an isolated copy for
verification; exact results are in the [delivery record](delivery-checklist.md).

If Windows Smart App Control blocks an unsigned compiled assembly, record the
blocked local result and use independently reported CI evidence or an approved
development environment. Do not change application logic or disable operating
system security controls to bypass it.
