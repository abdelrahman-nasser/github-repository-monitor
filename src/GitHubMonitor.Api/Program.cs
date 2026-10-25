using GitHubMonitor.Api.Clients;
using GitHubMonitor.Api.Extensions;
using GitHubMonitor.Api.Models;

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

// Controller-based endpoints
app.MapControllers();

// Temporary WCF connectivity diagnostics
if (app.Environment.IsDevelopment())
{
    app.MapGet("/api/diagnostics/wcf",
        async (
            IWcfMonitorClient client,
            CancellationToken cancellationToken) =>
        {
            var result = await client.PingAsync(cancellationToken);

            return Results.Ok(new ApiResponse<string>(
                    Success: true,
                    Message: "WCF connection successful",
                    Data: result));
        })
        .WithName("CheckWcfConnection")
        .WithOpenApi();
}

app.Run();
