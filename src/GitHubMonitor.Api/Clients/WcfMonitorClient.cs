using System.ServiceModel;
using GitHubMonitor.Api.Clients.Models;
using GitHubMonitor.Api.Configuration;
using Microsoft.Extensions.Options;

namespace GitHubMonitor.Api.Clients;

public sealed class WcfMonitorClient : IWcfMonitorClient
{
    private readonly WcfOptions _options;

    public WcfMonitorClient(IOptions<WcfOptions> options)
    {
        _options = options.Value;
    }

    public Task<string> PingAsync(
        CancellationToken cancellationToken = default)
    {
        return ExecuteAsync(
            client => client.PingAsync(),
            cancellationToken);
    }

    public Task<GitCommitDto[]> GetLiveCommitsAsync(
        CancellationToken cancellationToken = default)
    {
        return ExecuteAsync(
            client => client.GetLiveCommitsAsync(),
            cancellationToken);
    }

    private async Task<T> ExecuteAsync<T>(
        Func<IGitHubMonitorSoapClient, Task<T>> operation,
        CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();

        var binding = new BasicHttpBinding
        {
            OpenTimeout = TimeSpan.FromSeconds(5),
            SendTimeout = TimeSpan.FromSeconds(20),
            CloseTimeout = TimeSpan.FromSeconds(5)
        };

        var factory = new ChannelFactory<IGitHubMonitorSoapClient>(
            binding,
            new EndpointAddress(_options.EndpointUrl));

        IClientChannel? channel = null;
        var completed = false;

        try
        {
            var client = factory.CreateChannel();
            channel = (IClientChannel)client;

            var result = await operation(client)
                .WaitAsync(cancellationToken);

            completed = true;
            return result;
        }
        finally
        {
            if (completed)
            {
                CloseOrAbort(channel);
                CloseOrAbort(factory);
            }
            else
            {
                channel?.Abort();
                factory.Abort();
            }
        }
    }

    private static void CloseOrAbort(ICommunicationObject? resource)
    {
        if (resource is null)
        {
            return;
        }

        try
        {
            if (resource.State == CommunicationState.Faulted)
            {
                resource.Abort();
                return;
            }

            resource.Close();
        }
        catch (CommunicationException)
        {
            resource.Abort();
        }
        catch (TimeoutException)
        {
            resource.Abort();
        }
    }
}
