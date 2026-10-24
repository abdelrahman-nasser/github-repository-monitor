# GitHub Repository Monitor

A full-stack application for monitoring commits from a private GitHub
repository using ASP.NET Core, CoreWCF, Quartz.NET, Angular, and Kendo UI.

This project is a Full Stack .NET Developer technical assignment focused
on service integration, background scheduling, caching, and data visualization.

## Technology Stack

| Component    | Technology                     | Status      |
| ------------ | ------------------------------ | ----------- |
| Backend      | ASP.NET Core 8                 | Implemented |
| Architecture | Clean Architecture             | Implemented |
| SOAP Service | CoreWCF 1.9.1                  | Implemented |
| SOAP Client  | System.ServiceModel.Http 8.1.2 | Implemented |
| Scheduler    | Quartz.NET                     | Planned     |
| Cache        | In-Memory                      | Planned     |
| Frontend     | Angular + Kendo UI             | Planned     |
| Integration  | GitHub REST API                | Planned     |

## Architecture

The solution follows Clean Architecture principles with clear separation
between application logic, infrastructure, and communication layers.

### Current Communication Flow

```text
REST Client
    |
    v
ASP.NET Core API
    |
    | SOAP / HTTP
    v
CoreWCF Host
    |
    v
Ping Operation
```

The API communicates with CoreWCF through a SOAP client adapter without
referencing the CoreWCF Host implementation.

### Planned Integration Flow

Live commits:

```text
Angular
   |
   v
ASP.NET Core API
   |
   v
CoreWCF Service
   |
   v
GitHub REST API
```

Scheduled commits:

```text
Quartz Scheduler
   |
   v
GitHub REST API
   |
   v
In-Memory Cache
   |
   v
CoreWCF Service
   |
   v
ASP.NET Core API
   |
   v
Angular
```

## Solution Structure

```text
GitHubRepositoryMonitor/
├── src/
│   ├── GitHubMonitor.Domain/
│   ├── GitHubMonitor.Application/
│   ├── GitHubMonitor.Infrastructure/
│   ├── GitHubMonitor.Wcf.Contracts/
│   ├── GitHubMonitor.Wcf.Host/
│   └── GitHubMonitor.Api/
├── tests/
├── docs/
├── GitHubRepositoryMonitor.sln
├── .editorconfig
├── .gitignore
└── README.md
```

### Project Responsibilities

| Project        | Responsibility                             |
| -------------- | ------------------------------------------ |
| Domain         | Core models and domain rules               |
| Application    | Use cases and application abstractions     |
| Infrastructure | External integrations and caching          |
| Wcf.Contracts  | SOAP service contracts and DTOs            |
| Wcf.Host       | CoreWCF hosting and service implementation |
| Api            | REST endpoints and SOAP client integration |

### Dependency Rules

- Domain has no project dependencies.
- Application depends on Domain.
- Infrastructure depends on Application.
- Wcf.Contracts is independent of the application layers.
- Wcf.Host references Application, Infrastructure, and Wcf.Contracts.
- Api communicates with Wcf.Host through SOAP over HTTP.
- Api does not reference the WCF Host or Infrastructure projects.

## Prerequisites

The current backend foundation requires:

- .NET SDK capable of building .NET 8 projects.
- .NET 8 Runtime.
- ASP.NET Core 8 Runtime.
- Git.
- Visual Studio or VS Code.

The frontend implementation will additionally require:

- Node.js and npm.
- Angular CLI.
- A compatible Kendo UI version.
- An active Kendo UI license or trial.

## Getting Started

Run all commands from the repository root.

### 1. Restore Dependencies

```powershell
dotnet restore GitHubRepositoryMonitor.sln
```

### 2. Build the Solution

```powershell
dotnet build GitHubRepositoryMonitor.sln
```

All six backend projects should build successfully.

### 3. Start the CoreWCF Host

Open a terminal and run:

```powershell
dotnet run --project src/GitHubMonitor.Wcf.Host --urls http://localhost:5101
```

Verify the following endpoints:

- [CoreWCF Health Endpoint][wcf-health]
- [CoreWCF WSDL Metadata][wcf-wsdl]

The SOAP service currently exposes a temporary `Ping()` operation
for verifying communication between the API and CoreWCF.

### 4. Configure the ASP.NET Core API

Open the following configuration file:

`src/GitHubMonitor.Api/appsettings.Development.json`

Ensure the WCF configuration contains:

```json
{
  "Wcf": {
    "EndpointUrl": "http://localhost:5101/GitHubMonitorService.svc"
  }
}
```

Merge this section with existing settings if necessary.

The API uses strongly typed configuration through `WcfOptions`.

Configuration values are validated during application startup.

### 5. Start the ASP.NET Core API

Open another terminal and run:

```powershell
dotnet run --project src/GitHubMonitor.Api --urls http://localhost:5100
```

Swagger is available in Development mode:

[Swagger UI][swagger-ui]

The current local setup uses HTTP. HTTPS must be configured before
exposing these services outside the development environment.

### 6. Verify SOAP Communication

Ensure both the API and CoreWCF Host are running.

Execute:

```powershell
Invoke-RestMethod http://localhost:5100/api/diagnostics/wcf
```

Expected response:

```json
{
  "success": true,
  "message": "WCF connection successful",
  "data": "GitHub Monitor WCF is running"
}
```

This verifies communication between the REST API and CoreWCF
through a real SOAP request.

## Error Handling

The API uses centralized exception handling through
`GlobalExceptionHandler`.

All handled API errors follow a unified response structure:

```json
{
  "success": false,
  "message": "Unable to communicate with WCF service.",
  "data": null
}
```

### HTTP Error Mapping

| HTTP Status | Description                              |
| ----------- | ---------------------------------------- |
| 503         | WCF unavailable or communication failure |
| 504         | Upstream service timeout                 |
| 500         | Unexpected application error             |

The API logs exceptions internally and returns sanitized messages
to clients.

### Verified Scenarios

- Successful SOAP communication returns HTTP 200.
- Unavailable CoreWCF service returns HTTP 503.
- Invalid WCF endpoint configuration prevents application startup.

Timeout and cancellation scenarios require additional testing.

## Configuration and Security

### WCF Configuration

WCF endpoint settings are managed through strongly typed options.

The configuration uses startup validation to reject invalid URLs.

### GitHub Authentication

GitHub authentication is not implemented yet.

The planned implementation will use a read-only GitHub Personal
Access Token or another authorized access mechanism.

The integration will follow these security rules:

- Store credentials outside source control.
- Use read-only permissions.
- Keep authentication in the server-side integration layer.
- Never expose GitHub credentials to Angular.
- Never log authentication tokens.
- Use HTTPS when communicating with GitHub.

GitHub authentication setup will be documented after implementation.

## Code Quality

The repository includes `.editorconfig` for consistent formatting
and coding conventions.

### C# Formatting

Apply formatting:

```powershell
dotnet format GitHubRepositoryMonitor.sln
```

Verify formatting:

```powershell
dotnet format GitHubRepositoryMonitor.sln --verify-no-changes
```

### Markdown Formatting

Format the README:

```powershell
npx --yes prettier@3 --write README.md
```

Validate Markdown rules:

```powershell
npx --yes markdownlint-cli2 README.md "docs/**/*.md"
```

### Build Verification

```powershell
dotnet build GitHubRepositoryMonitor.sln
```

All quality checks should pass before committing changes.

## Implementation Status

| Feature                           | Status    |
| --------------------------------- | --------- |
| Clean Architecture foundation     | Completed |
| CoreWCF SOAP hosting              | Completed |
| WSDL metadata                     | Completed |
| SOAP Ping operation               | Completed |
| API-to-WCF communication          | Completed |
| Asynchronous SOAP client          | Completed |
| Centralized exception handling    | Completed |
| Strongly typed configuration      | Completed |
| Dependency injection organization | Completed |
| Code formatting configuration     | Completed |
| GitHub authentication             | Planned   |
| GitHub commit retrieval           | Planned   |
| Quartz scheduling                 | Planned   |
| Scheduled commit cache            | Planned   |
| Live and scheduled REST endpoints | Planned   |
| Angular application               | Planned   |
| Kendo Grid and Dialog             | Planned   |
| Automated tests                   | Planned   |

## Planned Functionality

### Live Commits

The live operation will retrieve the latest ten commits directly
from the configured private GitHub repository.

The API will expose:

`GET /api/github/live`

### Scheduled Commits

Quartz.NET will synchronize the latest ten commits every minute.

The results will be stored in an in-memory cache with a
`LastSyncTime` timestamp.

The API will expose:

`GET /api/github/scheduled`

Scheduled reads will return cached data without requesting GitHub
data directly.

### Angular Dashboard

The frontend will provide a page named GitHub Repository Monitor.

The page will include:

- Live Commits section with a refresh button.
- Scheduled Commits section with `LastSyncTime`.
- Kendo Grids for displaying commit information.
- Kendo Dialog for error messages.
- Responsive layout.

Each grid will display commit message, author, date, SHA, and source.

## Architecture Decisions

The current architecture uses the following decisions:

- Clean Architecture for separation of concerns.
- .NET 8 for all backend projects.
- CoreWCF for SOAP hosting.
- System.ServiceModel for SOAP client communication.
- Dependency injection for service registration.
- Strongly typed options for configuration.
- Centralized API exception handling.
- In-memory caching for scheduled data (planned).
- Quartz.NET within the CoreWCF Host (planned).

CoreWCF is used instead of classic .NET Framework WCF.

Detailed architecture documentation and design decisions
will be maintained under the `docs/` directory.

## Assignment Deliverables

The final submission will include:

- CoreWCF service implementation.
- Quartz scheduler implementation.
- ASP.NET Core REST API.
- Angular application using Kendo UI.
- Private GitHub repository integration.
- Authentication configuration instructions.
- Architecture documentation.
- Setup and execution instructions.

This README will be updated as development progresses.

## Local Development Links

- [CoreWCF Health][wcf-health]
- [SOAP WSDL][wcf-wsdl]
- [API Swagger][swagger-ui]

[wcf-health]: http://localhost:5101/health
[wcf-wsdl]: http://localhost:5101/GitHubMonitorService.svc?wsdl
[swagger-ui]: http://localhost:5100/swagger
