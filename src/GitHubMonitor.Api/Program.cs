using GitHubMonitor.Api.Clients;
using GitHubMonitor.Api.ExceptionHandling;

var builder = WebApplication.CreateBuilder(args);

// API documentation
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// WCF SOAP client
builder.Services.AddTransient<IWcfMonitorClient, WcfMonitorClient>();

// Global exception handling
builder.Services.AddExceptionHandler<GlobalExceptionHandler>();
builder.Services.AddProblemDetails();

var app = builder.Build();

// Exception handling middleware
app.UseExceptionHandler();

// Swagger (Development only)
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

// HTTPS redirection
app.UseHttpsRedirection();

// Temporary WCF connectivity test
app.MapGet("/api/diagnostics/wcf",
    async (IWcfMonitorClient client, CancellationToken cancellationToken) =>
    {
        var result = await client.PingAsync(cancellationToken);

        return Results.Ok(new
        {
            success = true,
            message = "WCF connection successful",
            data = result
        });
    })
    .WithName("CheckWcfConnection")
    .WithOpenApi();

app.Run();