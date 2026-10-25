using CoreWCF;
using CoreWCF.Configuration;
using CoreWCF.Description;
using GitHubMonitor.Application.Abstractions;
using GitHubMonitor.Application.UseCases;
using GitHubMonitor.Wcf.Contracts;
using GitHubMonitor.Wcf.Host.Extensions;
using GitHubMonitor.Wcf.Host.Services;

var builder = WebApplication.CreateBuilder(args);

// Register CoreWCF services
builder.Services.AddServiceModelServices();

// Enable WSDL metadata generation
builder.Services.AddServiceModelMetadata();

// Register our service implementation
builder.Services.AddTransient<GitHubMonitorService>();
builder.Services.AddGitHubIntegration(builder.Configuration);

var app = builder.Build();

// Configure SOAP service and endpoint
app.UseServiceModel(serviceBuilder =>
{
    serviceBuilder.AddService<GitHubMonitorService>();

    serviceBuilder.AddServiceEndpoint<
        GitHubMonitorService,
        IGitHubMonitorService>(
            new BasicHttpBinding(),
            "/GitHubMonitorService.svc");
});

// Enable WSDL over HTTP for local development
var metadata = app.Services
    .GetRequiredService<ServiceMetadataBehavior>();

metadata.HttpGetEnabled = true;

// Simple HTTP health endpoint
app.MapGet("/health", () => Results.Ok(new
{
    status = "healthy",
    service = "GitHubMonitor.Wcf.Host"
}));


if (app.Environment.IsDevelopment())
{
    // Temporary GitHub integration test
    app.MapGet("/diagnostics/github",
        async (
            GetLiveCommitsUseCase useCase,
            CancellationToken cancellationToken) =>
        {
            var commits = await useCase.ExecuteAsync(cancellationToken);

            return Results.Ok(new
            {
                count = commits.Count,
                commits
            });
        });

    // Inspect the scheduled cache during development
    app.MapGet("/diagnostics/scheduled",
        (IScheduledCommitsStore store) =>
        {
            var snapshot = store.GetSnapshot();

            return Results.Ok(new
            {
                count = snapshot.Commits.Count,
                lastSyncTime = snapshot.LastSyncTime
            });
        });
}


app.Run();
