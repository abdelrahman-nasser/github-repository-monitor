using GitHubMonitor.Api.Clients;
using GitHubMonitor.Api.Extensions;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddApiServices(builder.Configuration);

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
