# System Architecture

GitHub Repository Monitor uses six .NET 8 projects and an Angular dashboard. The
REST API and CoreWCF host are separate processes. Quartz runs inside the CoreWCF
host and shares its in-memory scheduled snapshot.

See the [README](../README.md) for the architecture diagram, startup commands,
versions, and public API examples. See the
[delivery checklist](delivery-checklist.md) for verification evidence and
outstanding delivery checks.

## Layers and dependency direction

| Project                        | Responsibility                                                                 | Direct project references              |
| ------------------------------ | ------------------------------------------------------------------------------ | -------------------------------------- |
| `GitHubMonitor.Domain`         | Immutable `GitCommit` model                                                    | None                                   |
| `GitHubMonitor.Application`    | `GetLiveCommitsUseCase`, provider/store abstractions, scheduled snapshot model | Domain                                 |
| `GitHubMonitor.Infrastructure` | GitHub HTTP provider, response mapping, in-memory snapshot store               | Application                            |
| `GitHubMonitor.Wcf.Contracts`  | SOAP service interface and data contracts                                      | None                                   |
| `GitHubMonitor.Wcf.Host`       | SOAP implementation, dependency composition, Quartz job and trigger            | Contracts, Application, Infrastructure |
| `GitHubMonitor.Api`            | REST controllers, SOAP client adapter, API exception handling                  | None                                   |

Application depends on Domain; Infrastructure implements Application
abstractions and accesses Domain transitively. The host composes these
implementations. The API has its own compatible SOAP interface and DTOs and
communicates over HTTP rather than referencing the host assembly. Changes to
SOAP contracts must preserve compatibility between the server and client
definitions.

## Request and data flows

### Live commits

1. Angular requests `GET /api/github/live` through its configured API service.
2. The API controller calls `WcfMonitorClient`.
3. The adapter invokes the `GetLiveCommits` SOAP operation.
4. `GitHubMonitorService` executes `GetLiveCommitsUseCase`.
5. `GitHubCommitProvider` requests GitHub's commits endpoint with `per_page=10`
   and the optional configured branch filter.
6. The service maps commits to SOAP DTOs with source `Live`; the API wraps the
   result in its JSON response envelope.

Every live request fetches GitHub data. It does not read or update the scheduled
snapshot. Authentication stays in the server-side provider's Bearer header.

### Scheduled commits

1. Quartz invokes `SyncGitHubCommitsJob` in the CoreWCF host.
2. The job calls `IGitHubCommitProvider` directly.
3. After a successful fetch, the job saves commits and the current UTC time to
   the singleton `IScheduledCommitsStore`.
4. Angular requests `GET /api/github/scheduled`.
5. The API invokes `GetScheduledCommits` through SOAP.
6. The SOAP service reads the shared snapshot, maps source `Scheduled`, and
   returns the commits and `LastSyncTime`.

Scheduled reads make no GitHub request. There is no separate scheduled-read use
case or scheduler process.

## Scheduler and cache lifecycle

The job identity is `sync-github-commits`, with trigger
`sync-github-commits-trigger`. The trigger starts immediately and repeats every
minute. `[DisallowConcurrentExecution]` prevents overlapping runs for this job.
Quartz follows the host lifetime and waits for running jobs during shutdown.

The store starts with an empty commit list and a null timestamp. Each successful
sync publishes a defensive, read-only snapshot capped at ten commits under a
lock. A successful empty result also replaces the cache and advances the
timestamp. `LastSyncTime` records the successful synchronization time, rather
than a commit's date or a UI refresh time.

On a fetch failure, the job logs the error and preserves the previous commits
and timestamp. The next scheduled run attempts another fetch. There is no cache
expiry, stale-data flag, or additional retry policy. Before any successful sync,
failed attempts leave the empty list and null timestamp in place. Shutdown
cancellation propagates without replacing the snapshot.

The cache is process-local and has no persistence. Restarting the host clears
it; multiple host instances would maintain independent snapshots. No database is
required.

## Hosting, configuration, and failure boundaries

The host exposes a `BasicHttpBinding` endpoint at `/GitHubMonitorService.svc`,
HTTP metadata at the same path with `?wsdl`, and `/health`. SOAP operations are
`Ping`, `GetLiveCommits`, and `GetScheduledCommits`. The compatible client
contract uses namespace `http://tempuri.org/`.

Development-only host diagnostics are `/diagnostics/github` and
`/diagnostics/scheduled`. The API exposes Swagger and `/api/diagnostics/wcf`
only in Development.

The host validates nonblank `GitHub:Owner`, `GitHub:Repository`, and
`GitHub:Token` at startup. `GitHub:Branch` is optional. The API validates
`Wcf:EndpointUrl` as an absolute HTTP or HTTPS URL. Configuration validation
does not check upstream availability or repository authorization.

GitHub operations have one linked cancellation deadline, default 15 seconds,
covering sending, headers, and reading/deserializing the body. The configured
`GitHub:RequestTimeout` must be positive and at most 15 seconds. HttpClient's
own timeout is infinite so there are no competing timers. Caller and Quartz
shutdown cancellation propagate; only deadline expiry becomes an upstream
timeout. The API creates a SOAP channel
and factory per operation, with 5-second open/close and 20-second send timeouts.
Completed channels are closed; faulted or incomplete operations are aborted. API
cancellation stops waiting and aborts the client resources; the SOAP contract
does not forward that cancellation token to GitHub.

The API's handled errors use
`{ "success": false, "message": "...", "data": null }`:

| Failure recognized by the API                    | HTTP status | Response message                                                          |
| ------------------------------------------------ | ----------- | ------------------------------------------------------------------------- |
| Typed GitHub authentication fault (upstream 401) | 502         | `GitHub authentication failed. Check the server-side GitHub credentials.` |
| Typed GitHub timeout fault                       | 504         | `GitHub request timed out. Please try again.`                             |
| `EndpointNotFoundException`                      | 503         | `WCF service is unavailable.`                                             |
| SOAP-client `TimeoutException`                   | 504         | `WCF service request timed out.`                                          |
| Other `CommunicationException`                   | 503         | `Unable to communicate with WCF service.`                                 |
| Unexpected/untyped SOAP fault or exception       | 500         | `An unexpected error occurred.`                                           |

The service translates known provider failures into a code-only `GitHubFault`.
Server and client use fault name `GitHubFault`, namespace
`urn:github-monitor:faults`, and action
`http://tempuri.org/IGitHubMonitorService/GetLiveCommits/GitHubFault`.
No exception, raw upstream body, credential, or stack trace is serialized.
The API handles the typed fault before generic SOAP communication failures and
selects a fixed safe REST message. Other recognized GitHub access, rate-limit,
or availability faults use 502. An upstream 401 indicates the server's GitHub
credentials failed, so Angular shows an error rather than requesting a login.
The assignment does not prescribe this downstream REST status mapping.

Scheduled sync failures are handled by the job, so cached reads can still
succeed with older data and the previous `LastSyncTime`. Angular API mode keeps
its independent section error/loading states, shows the safe envelope message
in the Kendo Dialog, and never falls back to mock success data.

The documented setup is for local HTTP development. Both SOAP bindings use their
default transport settings, and the application does not authenticate REST or
SOAP callers. The API's HTTPS redirection and its acceptance of an HTTPS
configuration URL do not configure SOAP transport security. External deployment
requires an explicit hosting and access-control configuration.

## Verification scope

Backend unit tests cover provider mapping and error handling, cache
initialization and snapshot replacement, job success/failure/cancellation, and
controller responses and cancellation forwarding. They use fake or mocked
upstream dependencies.

Test-only local SOAP and REST hosts with a fake upstream exercise authentication
and timeout faults through the actual client, serializer, and REST envelope.
Provider fixtures cover more/fewer than ten commits, required headers, deadlines
before headers and during body reads, and explicit cancellation. Scheduled
tests verify failure preserves the snapshot and cached reads avoid GitHub.
There are no automated real private-GitHub or wall-clock Quartz checks, nor
concurrent cache stress tests. Current execution results and prior manual
evidence are separated in the [delivery checklist](delivery-checklist.md).
