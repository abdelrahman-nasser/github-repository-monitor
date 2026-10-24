using CoreWCF;
using CoreWCF.Configuration;
using CoreWCF.Description;
using GitHubMonitor.Wcf.Contracts;
using GitHubMonitor.Wcf.Host.Services;

var builder = WebApplication.CreateBuilder(args);

// Register CoreWCF services
builder.Services.AddServiceModelServices();

// Enable WSDL metadata generation
builder.Services.AddServiceModelMetadata();

// Register our service implementation
builder.Services.AddTransient<GitHubMonitorService>();

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

app.Run();