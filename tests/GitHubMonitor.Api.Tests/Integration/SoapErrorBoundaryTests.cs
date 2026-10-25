using System.Net;
using System.Reflection;
using System.Runtime.Serialization;
using System.ServiceModel;
using System.Text.Json;
using CoreWCF.Configuration;
using GitHubMonitor.Api.Clients;
using GitHubMonitor.Api.Configuration;
using GitHubMonitor.Api.Controllers;
using GitHubMonitor.Api.ExceptionHandling;
using GitHubMonitor.Application.Abstractions;
using GitHubMonitor.Application.UseCases;
using GitHubMonitor.Domain.Models;
using GitHubMonitor.Infrastructure.GitHub;
using GitHubMonitor.Infrastructure.Scheduling;
using GitHubMonitor.Wcf.Contracts;
using GitHubMonitor.Wcf.Host.Services;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using ClientFault = GitHubMonitor.Api.Clients.Models.GitHubFault;

namespace GitHubMonitor.Api.Tests.Integration;

public sealed class SoapErrorBoundaryTests
{
    [Theory]
    [InlineData("Authentication", 502, "GitHub authentication failed. Check the server-side GitHub credentials.")]
    [InlineData("Timeout", 504, "GitHub request timed out. Please try again.")]
    [InlineData("Unexpected", 500, "An unexpected error occurred.")]
    [InlineData("WcfUnavailable", 503, "WCF service is unavailable.")]
    public async Task LiveFailure_CrossesSoapAndReturnsSafeRestEnvelope(
        string scenario, int status, string message)
    {
        await using var fixture = await BoundaryHost.StartAsync(scenario);

        if (scenario is "Authentication" or "Timeout")
        {
            // A real System.ServiceModel client deserializes a fault emitted by CoreWCF
            // over loopback HTTP. A matching CLR-only exception would not prove this.
            var fault = await Assert.ThrowsAsync<FaultException<ClientFault>>(
                () => fixture.SoapClient.GetLiveCommitsAsync().WaitAsync(TimeSpan.FromSeconds(5)));
            Assert.Equal(scenario, fault.Detail.Code);
            // BasicHttpBinding uses SOAP 1.1 without WS-Addressing, so no action header
            // is returned. Contract metadata is checked separately below.
            Assert.Null(fault.Action);
            Assert.DoesNotContain("fake-upstream-sensitive-body", fault.ToString());
        }

        using var response = await fixture.HttpClient.GetAsync("/api/github/live");
        var body = await response.Content.ReadAsStringAsync();
        using var json = JsonDocument.Parse(body);

        Assert.Equal(status, (int)response.StatusCode);
        Assert.False(json.RootElement.GetProperty("success").GetBoolean());
        Assert.Equal(message, json.RootElement.GetProperty("message").GetString());
        Assert.Equal(JsonValueKind.Null, json.RootElement.GetProperty("data").ValueKind);
        Assert.DoesNotContain("fake-upstream-sensitive-body", body);
        Assert.DoesNotContain("fake-test-token", body);
        Assert.DoesNotContain("stackTrace", body);
    }

    [Fact]
    public void FaultContracts_DeclareMatchingNamesNamespacesActionsAndSerialization()
    {
        var server = typeof(IGitHubMonitorService).GetMethod("GetLiveCommitsAsync")!
            .GetCustomAttribute<CoreWCF.FaultContractAttribute>()!;
        var client = typeof(IGitHubMonitorSoapClient).GetMethod("GetLiveCommitsAsync")!
            .GetCustomAttribute<FaultContractAttribute>()!;
        Assert.Equal("GitHubFault", server.Name);
        Assert.Equal("urn:github-monitor:faults", server.Namespace);
        Assert.Equal(ClientFault.Action, server.Action);
        Assert.Equal(server.Name, client.Name);
        Assert.Equal(server.Namespace, client.Namespace);
        Assert.Equal(server.Action, client.Action);
        var serverData = server.DetailType.GetCustomAttribute<DataContractAttribute>()!;
        var clientData = client.DetailType.GetCustomAttribute<DataContractAttribute>()!;
        Assert.Equal(serverData.Name, clientData.Name);
        Assert.Equal(serverData.Namespace, clientData.Namespace);
    }

    [Theory]
    [InlineData("RateLimitedForbidden", "RateLimited", "GitHub rate limit exceeded. Please try again later.")]
    [InlineData("AccessDenied", "AccessDenied", "GitHub denied repository access. Check the server-side GitHub permissions.")]
    [InlineData("RateLimited429", "RateLimited", "GitHub rate limit exceeded. Please try again later.")]
    public async Task RateLimitClassification_CrossesSoapAndRestWithoutMessageMatching(
        string scenario, string expectedCode, string expectedMessage)
    {
        await using var fixture = await BoundaryHost.StartAsync(scenario);

        var fault = await Assert.ThrowsAsync<FaultException<ClientFault>>(
            () => fixture.SoapClient.GetLiveCommitsAsync().WaitAsync(TimeSpan.FromSeconds(5)));
        Assert.Equal(expectedCode, fault.Detail.Code);

        using var response = await fixture.HttpClient.GetAsync("/api/github/live");
        var body = await response.Content.ReadAsStringAsync();
        using var json = JsonDocument.Parse(body);
        Assert.Equal(HttpStatusCode.BadGateway, response.StatusCode);
        Assert.False(json.RootElement.GetProperty("success").GetBoolean());
        Assert.Equal(expectedMessage, json.RootElement.GetProperty("message").GetString());
        Assert.Equal(JsonValueKind.Null, json.RootElement.GetProperty("data").ValueKind);
        Assert.DoesNotContain("fake-upstream-sensitive-body", body);
        Assert.DoesNotContain("fake-test-token", body);
    }

    [Fact]
    public async Task ScheduledRead_CrossesSoapUsesOnlyCacheAndPreservesSourceAndTimestamp()
    {
        await using var fixture = await BoundaryHost.StartAsync("Authentication");
        var timestamp = DateTimeOffset.Parse("2026-10-24T12:00:00Z");
        fixture.Store.Save(Enumerable.Range(1, 12)
            .Select(index => new GitCommit($"sha-{index}", $"Commit {index}", "Author", timestamp))
            .ToArray(), timestamp);

        var snapshot = await fixture.SoapClient.GetScheduledCommitsAsync();

        Assert.Equal(10, snapshot.Commits.Length);
        Assert.Equal("sha-1", snapshot.Commits[0].Sha);
        Assert.Equal("sha-10", snapshot.Commits[9].Sha);
        Assert.All(snapshot.Commits, commit => Assert.Equal("Scheduled", commit.Source));
        Assert.Equal(timestamp.UtcDateTime, snapshot.LastSyncTime);
        Assert.Equal(0, fixture.Upstream.RequestCount);
    }

    private sealed class BoundaryHost : IAsyncDisposable
    {
        private readonly WebApplication _app;
        private readonly HttpClient _upstreamClient;
        private string _endpoint = string.Empty;

        private BoundaryHost(WebApplication app, HttpClient upstreamClient,
            FakeUpstream upstream, InMemoryScheduledCommitsStore store)
        {
            _app = app;
            _upstreamClient = upstreamClient;
            Upstream = upstream;
            Store = store;
            HttpClient = new HttpClient { Timeout = TimeSpan.FromSeconds(5) };
        }

        public HttpClient HttpClient { get; }
        public FakeUpstream Upstream { get; }
        public InMemoryScheduledCommitsStore Store { get; }
        public WcfMonitorClient SoapClient => new(Options.Create(new WcfOptions { EndpointUrl = _endpoint }));

        public static async Task<BoundaryHost> StartAsync(string scenario)
        {
            var builder = WebApplication.CreateBuilder(new WebApplicationOptions
            {
                EnvironmentName = "Production",
                ApplicationName = typeof(GitHubController).Assembly.FullName
            });
            builder.Logging.ClearProviders();
            builder.WebHost.UseUrls("http://127.0.0.1:0");
            builder.Services.AddServiceModelServices();
            builder.Services.AddControllers().AddApplicationPart(typeof(GitHubController).Assembly);
            builder.Services.AddExceptionHandler<GlobalExceptionHandler>();
            builder.Services.AddProblemDetails();

            var upstream = new FakeUpstream(scenario);
            var upstreamClient = new HttpClient(upstream) { Timeout = Timeout.InfiniteTimeSpan };
            builder.Services.AddSingleton<IGitHubCommitProvider>(new GitHubCommitProvider(
                upstreamClient, new GitHubOptions
                {
                    Owner = "test-owner",
                    Repository = "test-repository",
                    Token = "fake-test-token",
                    RequestTimeout = TimeSpan.FromMilliseconds(100)
                }));
            var store = new InMemoryScheduledCommitsStore();
            builder.Services.AddSingleton<IScheduledCommitsStore>(store);
            builder.Services.AddTransient<GetLiveCommitsUseCase>();
            builder.Services.AddTransient<GitHubMonitorService>();

            BoundaryHost? fixture = null;
            builder.Services.AddTransient<IWcfMonitorClient>(_ => fixture!.SoapClient);
            var app = builder.Build();
            fixture = new BoundaryHost(app, upstreamClient, upstream, store);
            app.UseExceptionHandler();
            ((IApplicationBuilder)app).UseServiceModel(services =>
            {
                services.AddService<GitHubMonitorService>();
                services.AddServiceEndpoint<GitHubMonitorService, IGitHubMonitorService>(
                    new CoreWCF.BasicHttpBinding(), "/GitHubMonitorService.svc");
            });
            app.MapControllers();

            using var startup = new CancellationTokenSource(TimeSpan.FromSeconds(10));
            await app.StartAsync(startup.Token);
            var address = app.Urls.Single();
            fixture.HttpClient.BaseAddress = new Uri(address);
            fixture._endpoint = address + (scenario == "WcfUnavailable"
                ? "/missing-service.svc" : "/GitHubMonitorService.svc");
            return fixture;
        }

        public async ValueTask DisposeAsync()
        {
            HttpClient.Dispose();
            using var shutdown = new CancellationTokenSource(TimeSpan.FromSeconds(5));
            await _app.StopAsync(shutdown.Token);
            await _app.DisposeAsync();
            _upstreamClient.Dispose();
        }
    }

    private sealed class FakeUpstream(string scenario) : HttpMessageHandler
    {
        public int RequestCount { get; private set; }

        protected override Task<HttpResponseMessage> SendAsync(
            HttpRequestMessage request, CancellationToken cancellationToken)
        {
            RequestCount++;
            var status = scenario switch
            {
                "Authentication" => HttpStatusCode.Unauthorized,
                "RateLimitedForbidden" or "AccessDenied" => HttpStatusCode.Forbidden,
                "RateLimited429" => HttpStatusCode.TooManyRequests,
                _ => HttpStatusCode.OK
            };
            var response = new HttpResponseMessage(status)
            {
                Content = scenario == "Timeout"
                    ? new StreamContent(new StallingStream())
                    : new StringContent("fake-upstream-sensitive-body")
            };
            if (scenario is "RateLimitedForbidden" or "AccessDenied")
            {
                response.Headers.Add("X-RateLimit-Remaining",
                    scenario == "RateLimitedForbidden" ? "0" : "10");
            }
            return Task.FromResult(response);
        }
    }

    private sealed class StallingStream : Stream
    {
        public override bool CanRead => true;
        public override bool CanSeek => false;
        public override bool CanWrite => false;
        public override long Length => throw new NotSupportedException();
        public override long Position { get => throw new NotSupportedException(); set => throw new NotSupportedException(); }

        public override async ValueTask<int> ReadAsync(Memory<byte> buffer, CancellationToken cancellationToken = default)
        {
            await Task.Delay(Timeout.InfiniteTimeSpan, cancellationToken);
            return 0;
        }

        public override int Read(byte[] buffer, int offset, int count) => throw new NotSupportedException();
        public override void Flush() => throw new NotSupportedException();
        public override long Seek(long offset, SeekOrigin origin) => throw new NotSupportedException();
        public override void SetLength(long value) => throw new NotSupportedException();
        public override void Write(byte[] buffer, int offset, int count) => throw new NotSupportedException();
    }
}
