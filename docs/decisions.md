# Architecture Decisions

These decisions describe the implemented repository. The original three-page
assignment PDF was independently reviewed on 2026-10-26; requirement page
references are in the delivery matrix. See [architecture](architecture.md) for
the current flows and [delivery evidence](delivery-checklist.md) for
verification.

## Clean Architecture

**Status:** Implemented

Domain defines commit data; Application owns the live use case and
provider/store abstractions; Infrastructure implements GitHub access and
snapshot storage. The CoreWCF host composes these dependencies. This keeps
external integration concerns outside the core model and supports unit tests
with substituted providers.

The trade-off is additional projects and interfaces for a small application. The
implementation does not introduce a database, generic repository, MediatR, or
Unit of Work.

## CoreWCF on .NET 8 with separate contracts

**Status:** Implemented

CoreWCF hosts SOAP operations on the same .NET target as the rest of the
backend. The Contracts project separates the service interface and wire DTOs
from hosting and application behavior. This supports a clear SOAP boundary
without requiring classic .NET Framework WCF hosting.

The PDF requests WCF without explicitly naming CoreWCF. This is our choice for
hosting on .NET 8; explicit employer approval has not been obtained or claimed.

The API maintains compatible client-side contracts and DTOs separately. Both
definitions must remain synchronized at the SOAP protocol level.

## REST API as a SOAP client

**Status:** Implemented

ASP.NET Core presents JSON endpoints to Angular and delegates retrieval through
`WcfMonitorClient`. The API has no project reference to the SOAP host or
Infrastructure. The adapter owns channel creation, cancellation waiting, and
close/abort handling.

This adds a process boundary, serialization, and network overhead, while making
REST and SOAP responsibilities explicit.

## Validated configuration and centralized API errors

**Status:** Implemented

Strongly typed options validate required GitHub settings and the WCF endpoint
URL at startup. Runtime service availability is handled separately.
`IExceptionHandler` returns a common failure envelope. A small code-only SOAP
fault has matching server/client data contracts and preserves GitHub error
classification across the process boundary. Known faults are handled before
generic communication errors. Upstream authentication rejection maps to 502,
upstream timeout to 504, WCF availability to 503, and unexpected failure to 500.
The PDF requires graceful 401 handling but does not prescribe the downstream
status. Using 502 identifies a server integration credential problem without
requiring an application login. Only fixed safe messages reach REST clients.

One provider-owned deadline includes the headers and response body. Caller
cancellation propagates, while deadline expiry becomes an upstream timeout.
The 15-second provider deadline stays below the 20-second SOAP send timeout and
25-second Angular timeout. Test-only local hosts verify SOAP fault serialization
and REST mapping without real credentials or production failure endpoints.

## Quartz inside the CoreWCF host

**Status:** Implemented

Quartz starts with the SOAP host and runs a non-overlapping synchronization job
immediately, then every minute. Hosting both in one process lets the scheduler
and SOAP service share the singleton snapshot store without another service.

The PDF overview (page 1) orders Quartz, WCF, then GitHub; the detailed scheduler
flow (page 2) orders Quartz, GitHub, cache, WCF, REST, then Angular. The detailed
job steps are followed here. An additional SOAP round trip in the job would add
complexity without changing the specified cached result.

Scheduling and SOAP availability share one lifecycle. Restarting the host
restarts the scheduler and clears the snapshot.

## In-memory scheduled snapshot

**Status:** Implemented

A lock-protected store publishes defensive, read-only snapshots of up to ten
commits and the successful sync timestamp. Publishing only after a successful
fetch preserves useful cached data during GitHub failures. Live reads remain
independent of this cache.

No database setup is needed. The trade-offs are loss on restart, independent
caches across host instances, and potentially indefinite staleness during
repeated failures. The UI timestamp is the available indication of data age.

## Server-side GitHub authentication

**Status:** Implemented

The provider sends the configured token as a Bearer header over HTTPS to GitHub.
Token configuration belongs outside source control, with the least repository
access needed. API and SOAP DTOs contain commit data and synchronization
metadata, with no token field.

The operator must provision and maintain valid credentials. The local HTTP
REST/SOAP services themselves have no caller authentication; this setup targets
local assignment review.

## Angular and Kendo UI

**Status:** Implemented

Angular provides the dashboard with Kendo Grids, Dialog, and Buttons. Configured
mock and real API modes allow isolated UI development and full-stack review. The
Angular development proxy forwards API-mode requests to the local REST API.

Kendo requires a valid trial or commercial license. Local trial activation and a
successful CI build are separate from CI license activation. Current licensing,
bundle-size, and browser-verification limitations are recorded in the
[delivery checklist](delivery-checklist.md).
