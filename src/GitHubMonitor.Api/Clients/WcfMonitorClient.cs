using System.ServiceModel;
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

    public async Task<string> PingAsync(
        CancellationToken cancellationToken = default)
    {
        var url = _options.EndpointUrl;

        var binding = new BasicHttpBinding
        {
            OpenTimeout = TimeSpan.FromSeconds(5),
            SendTimeout = TimeSpan.FromSeconds(10),
            CloseTimeout = TimeSpan.FromSeconds(5)
        };

        var factory = new ChannelFactory<IGitHubMonitorSoapClient>(
            binding,
            new EndpointAddress(url));

        IClientChannel? channel = null;
        var completed = false;

        try
        {
            cancellationToken.ThrowIfCancellationRequested();

            var client = factory.CreateChannel();
            channel = (IClientChannel)client;

            var result = await client.PingAsync()
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
