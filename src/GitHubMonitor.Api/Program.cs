using GitHubMonitor.Api.Clients;

var builder = WebApplication.CreateBuilder(args);

// Services
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

builder.Services.AddTransient<WcfMonitorClient>();

var app = builder.Build();

// Middleware
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseHttpsRedirection();

// Endpoints
app.MapGet("/api/diagnostics/wcf", (WcfMonitorClient client) =>
{
    var result = client.Ping();

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
