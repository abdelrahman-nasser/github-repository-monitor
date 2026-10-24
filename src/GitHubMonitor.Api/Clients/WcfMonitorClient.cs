using System.ServiceModel;

namespace GitHubMonitor.Api.Clients;

public sealed class WcfMonitorClient
{
    private readonly IConfiguration _configuration;

    public WcfMonitorClient(IConfiguration configuration)
    {
        _configuration = configuration;
    }

    public string Ping()
    {
        var url = _configuration["Wcf:EndpointUrl"]
            ?? throw new InvalidOperationException(
                "WCF endpoint URL is not configured.");

        var binding = new BasicHttpBinding
        {
            OpenTimeout = TimeSpan.FromSeconds(5),
            SendTimeout = TimeSpan.FromSeconds(10),
            ReceiveTimeout = TimeSpan.FromSeconds(10)
        };

        var endpoint = new EndpointAddress(url);

        var factory = new ChannelFactory<IGitHubMonitorSoapClient>(
            binding, endpoint);

        IClientChannel? channel = null;

        try
        {
            var client = factory.CreateChannel();
            channel = (IClientChannel)client;

            var result = client.Ping();

            channel.Close();
            factory.Close();

            return result;
        }
        catch
        {
            channel?.Abort();
            factory.Abort();
            throw;
        }
    }
}