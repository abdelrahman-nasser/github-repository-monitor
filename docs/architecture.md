# System Architecture

## Overview

GitHub Repository Monitor follows Clean Architecture principles.

The solution separates core application logic, external integrations,
SOAP communication, and REST API responsibilities.

The system currently contains six .NET 8 projects.

Angular, GitHub integration, and background scheduling are planned
for subsequent development phases.

## Architecture Layers

| Layer          | Project                      |
| -------------- | ---------------------------- |
| Domain         | GitHubMonitor.Domain         |
| Application    | GitHubMonitor.Application    |
| Infrastructure | GitHubMonitor.Infrastructure |
| SOAP Contracts | GitHubMonitor.Wcf.Contracts  |
| SOAP Host      | GitHubMonitor.Wcf.Host       |
| REST API       | GitHubMonitor.Api            |

### Domain Layer

The Domain project represents the core business concepts.

Responsibilities:

- Define domain models and value objects.
- Encapsulate domain rules when required.
- Remain independent of external frameworks.

Current status: Project foundation created.

### Application Layer

The Application layer defines the system's use cases.

Planned responsibilities:

- Retrieve live commits.
- Retrieve scheduled commits.
- Synchronize cached commits.
- Define abstractions for external dependencies.

The Application layer depends only on Domain.

### Infrastructure Layer

Infrastructure implements external integration abstractions.

Planned responsibilities:

- GitHub REST API communication.
- GitHub authentication.
- Commit response mapping.
- In-memory snapshot storage.
- Technical support for scheduled synchronization.

Infrastructure depends on Application.

### WCF Contracts

The Contracts project defines the SOAP service interface.

Current implementation:

- `IGitHubMonitorService`
- `Ping()` connectivity operation

Planned operations:

- `GetLiveCommits()`
- `GetScheduledCommits()`

SOAP contracts remain separate from application logic.

### CoreWCF Host

The Host exposes SOAP services using CoreWCF.

Current responsibilities:

- Host the CoreWCF service.
- Configure SOAP endpoints.
- Expose WSDL metadata.
- Resolve service dependencies.
- Provide a health endpoint.

Planned responsibilities:

- Execute application use cases.
- Host Quartz.NET.
- Share the scheduled snapshot store with Quartz.

### ASP.NET Core API

The API exposes HTTP endpoints to external clients.

Current responsibilities:

- Communicate with CoreWCF through SOAP.
- Manage WCF client connections.
- Validate configuration at startup.
- Handle exceptions centrally.
- Expose Swagger documentation.
- Provide a temporary connectivity endpoint.

Planned responsibilities:

- Expose live commit retrieval.
- Expose scheduled commit retrieval.
- Return consistent API response models.

## Dependency Rules

Project references follow the dependency inversion principle.

Current direct project references:

| Project        | References                             |
| -------------- | -------------------------------------- |
| Domain         | None                                   |
| Application    | Domain                                 |
| Infrastructure | Application                            |
| Wcf.Contracts  | None                                   |
| Wcf.Host       | Contracts, Application, Infrastructure |
| Api            | None                                   |

Infrastructure accesses Domain transitively through Application.

The API communicates with the WCF Host over SOAP rather than
referencing its implementation assembly.

The WCF Server and SOAP Client use separate contract definitions
that must remain compatible at the SOAP protocol level.

## Current Communication Flow

The following flow has been implemented and tested:

    REST Client
        |
        | HTTP / JSON
        v
    ASP.NET Core API
        |
        | WCF Client Adapter
        | SOAP / HTTP
        v
    CoreWCF Host
        |
        v
    Ping()
        |
        v
    SOAP Response

The API converts the SOAP result into a JSON response.

The temporary diagnostic endpoint is:

`GET /api/diagnostics/wcf`

## Planned Live Commits Flow

The live operation will retrieve commits directly from GitHub.

    Angular
        |
        | REST
        v
    ASP.NET Core API
        |
        | SOAP
        v
    CoreWCF Service
        |
        v
    Application Use Case
        |
        v
    GitHub Client
        |
        | HTTPS
        v
    GitHub REST API

The live operation will not update the scheduled cache.

## Planned Scheduled Commits Flow

Quartz.NET will synchronize commits every minute.

### Background Synchronization

    Quartz Scheduler
        |
        v
    Application Sync Operation
        |
        v
    GitHub Client
        |
        v
    GitHub REST API
        |
        v
    Snapshot Store

The snapshot will contain:

- Latest ten commits.
- Last successful synchronization timestamp.

The cache will only be updated after a successful synchronization.

### Scheduled Data Retrieval

    Angular
        |
        v
    ASP.NET Core API
        |
        | SOAP
        v
    CoreWCF Service
        |
        v
    Application Use Case
        |
        v
    Snapshot Store

Scheduled reads will not request data from GitHub.

## Dependency Injection

Each executable application manages its own DI container.

### API Registration

API dependencies are registered through:

`ServiceCollectionExtensions.AddApiServices()`

Current registrations include:

- WCF client adapter.
- WCF endpoint configuration.
- Global exception handler.
- OpenAPI and Swagger services.

### CoreWCF Host Registration

The WCF Host registers the SOAP service and hosting services.

Quartz and the shared snapshot store will be registered in this
host during the scheduler implementation phase.

## Configuration

The API uses the Options Pattern.

`WcfOptions` contains the SOAP endpoint configuration.

Startup validation ensures that the endpoint URL is a valid
absolute HTTP or HTTPS address.

Invalid configuration prevents the application from starting.

Service availability is handled separately at request time.

## Error Handling

The API uses centralized exception handling.

The response contract follows this structure:

    {
      "success": false,
      "message": "Error description",
      "data": null
    }

Current error classifications:

| HTTP Status | Meaning                        |
| ----------- | ------------------------------ |
| 503         | WCF communication failure      |
| 504         | Service request timeout        |
| 500         | Unexpected application failure |

A successful SOAP request returns HTTP 200.

Verified scenarios include successful communication and
unavailable WCF service handling.

## Security

The current HTTP endpoints are intended for local development.

Planned security measures include:

- GitHub credentials stored outside source control.
- Read-only access to the private repository.
- HTTPS communication with GitHub.
- No GitHub credentials exposed to Angular.
- Sanitized error responses.
- No authentication tokens in application logs.

Transport security must be configured before external deployment.

## Technology Decisions

| Component            | Selection                      |
| -------------------- | ------------------------------ |
| Backend              | .NET 8                         |
| Architecture         | Clean Architecture             |
| SOAP Hosting         | CoreWCF                        |
| SOAP Client          | System.ServiceModel            |
| Dependency Injection | Built-in .NET DI               |
| Configuration        | Options Pattern                |
| Error Handling       | IExceptionHandler              |
| Scheduler            | Quartz.NET (planned)           |
| Cache                | In-Memory (planned)            |
| Frontend             | Angular and Kendo UI (planned) |

## Current Verification

The following checks have passed:

- Solution compilation.
- CoreWCF host startup.
- Health endpoint response.
- WSDL generation.
- Direct SOAP invocation.
- REST-to-SOAP communication.
- HTTP 503 when CoreWCF is unavailable.
- Configuration validation at startup.
- C# formatting verification.

The following are not yet verified:

- GitHub authentication and commit retrieval.
- Quartz synchronization.
- Concurrent snapshot access.
- Timeout and cancellation scenarios.
- Automated unit and integration tests.
- Angular frontend functionality.

## Future Considerations

The initial design targets a single CoreWCF Host instance.

Using a shared in-memory snapshot across multiple host instances
would require an alternative storage or synchronization strategy.

The architecture can be extended without changing the core
application contracts or the REST API's SOAP communication boundary.
