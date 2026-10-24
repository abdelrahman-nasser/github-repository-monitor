# Architecture Decisions

This document records the main architectural decisions for the
GitHub Repository Monitor project.

Each decision includes its rationale, alternatives, and trade-offs.

## Clean Architecture

**Status:** Implemented

### Decision

Use Clean Architecture with separate Domain, Application,
Infrastructure, and presentation-related projects.

### Rationale

- Enforce separation of concerns.
- Keep application logic independent of external integrations.
- Improve testability and maintainability.
- Establish explicit dependency boundaries.

### Alternatives

- Traditional layered architecture.
- Single-project architecture.

### Trade-offs

Clean Architecture introduces additional projects and abstractions.

For this assignment, unnecessary patterns such as generic
repositories, MediatR, and Unit of Work are intentionally avoided.

## CoreWCF on .NET 8

**Status:** Implemented

### Decision

Use CoreWCF on .NET 8 for SOAP service hosting.

### Rationale

- Support SOAP communication on modern .NET.
- Use built-in dependency injection.
- Maintain a consistent backend target framework.
- Avoid requiring .NET Framework for a new application.

### Alternatives

- Classic WCF on .NET Framework 4.8.

### Trade-offs

CoreWCF does not provide complete feature parity with classic WCF.

The SOAP features required by this project are supported by the
selected CoreWCF implementation.

## Separate SOAP Contracts and Host

**Status:** Implemented

### Decision

Maintain separate projects for SOAP contracts and service hosting.

### Rationale

- Separate service definitions from implementation.
- Keep SOAP DTOs independent of application logic.
- Make service contracts easier to maintain.
- Prevent hosting concerns from leaking into contracts.

### Trade-offs

An additional project increases solution complexity slightly.

The separation is retained to demonstrate explicit service boundaries.

## REST API and SOAP Communication

**Status:** Implemented

### Decision

Expose REST endpoints through ASP.NET Core and communicate
with CoreWCF using a dedicated SOAP client adapter.

### Rationale

- Keep REST and SOAP responsibilities separate.
- Avoid direct references to the WCF Host implementation.
- Encapsulate SOAP communication and channel management.
- Support centralized error handling.

### Trade-offs

SOAP introduces serialization and network overhead.

The API maintains a client-side SOAP contract compatible
with the server's published WSDL.

Both contracts must remain synchronized.

## Strongly Typed Configuration

**Status:** Implemented

### Decision

Use the Options Pattern with startup validation.

### Rationale

- Avoid scattered configuration keys.
- Validate required settings early.
- Improve type safety.
- Simplify testing and configuration management.

### Trade-offs

Configuration changes require maintaining corresponding
options classes and validation rules.

## Centralized Exception Handling

**Status:** Implemented

### Decision

Use ASP.NET Core `IExceptionHandler` for error classification
and consistent API responses.

### Rationale

- Avoid duplicated exception handling.
- Return appropriate HTTP status codes.
- Keep error responses consistent.
- Prevent internal exception details from reaching clients.

### Current Behavior

- HTTP 503 for WCF communication failures.
- HTTP 504 for recognized timeout exceptions.
- HTTP 500 for unexpected application failures.

Additional timeout and cancellation tests are planned.

## Quartz Scheduler Hosting

**Status:** Planned

### Decision

Host Quartz.NET within the CoreWCF Host application.

### Rationale

- Share the same application lifetime.
- Allow Quartz and WCF to access the same snapshot store.
- Avoid additional process communication.
- Reduce deployment complexity.

### Alternatives

- Dedicated scheduler service.
- Separate background worker application.

### Trade-offs

Scheduling and SOAP availability share one application lifecycle.

Restarting the host also restarts the scheduler.

## In-Memory Snapshot Cache

**Status:** Planned

### Decision

Use a thread-safe in-memory cache for scheduled commits.

### Rationale

- The assignment explicitly permits in-memory storage.
- No database setup is required.
- Reading cached commits remains fast.
- The expected data volume is small.

### Alternatives

- JSON file storage.
- Persistent database.
- Distributed cache.

### Trade-offs

Cached data is lost when the host restarts.

The initial deployment uses a single CoreWCF Host instance.

Multiple host instances would require a shared storage strategy.

A new snapshot will be published only after a successful
GitHub synchronization.

## GitHub Authentication

**Status:** Planned

### Decision

Use server-side authentication with a read-only GitHub token.

### Rationale

- Access private repository data securely.
- Prevent credentials from reaching Angular.
- Follow least-privilege principles.
- Keep GitHub integration inside Infrastructure.

### Security Rules

- Do not commit credentials.
- Do not expose tokens in API responses.
- Do not log authorization headers.
- Use HTTPS for GitHub communication.
- Store credentials in environment variables or a secret provider.

### Trade-offs

Tokens require secure provisioning, rotation, and expiration handling.

The integration must handle invalid or insufficient credentials.

## Angular and Kendo UI

**Status:** Planned

### Decision

Use Angular with Kendo UI for the monitoring dashboard.

### Rationale

- Satisfy the assignment's frontend requirements.
- Provide standardized grid and dialog components.
- Keep presentation concerns separate from backend logic.

### Trade-offs

Kendo UI requires a valid commercial or trial license.

Angular and Kendo package versions must be compatible.

## Review Policy

Architecture decisions may be revised when new requirements
or technical constraints are identified.

Significant changes should include updated rationale,
trade-offs, and implementation status.
