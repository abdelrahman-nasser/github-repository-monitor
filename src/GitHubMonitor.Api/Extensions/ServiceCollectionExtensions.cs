using GitHubMonitor.Api.Clients;
using GitHubMonitor.Api.Configuration;
using GitHubMonitor.Api.ExceptionHandling;

namespace GitHubMonitor.Api.Extensions;

public static class ServiceCollectionExtensions
{
    public static IServiceCollection AddApiServices(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        // API documentation
        services.AddEndpointsApiExplorer();
        services.AddSwaggerGen();

        // WCF configuration
        services.AddOptions<WcfOptions>()
            .Bind(configuration.GetSection(WcfOptions.SectionName))
            .Validate(
                options => Uri.TryCreate(
                    options.EndpointUrl,
                    UriKind.Absolute,
                    out var uri)
                    && (uri.Scheme == Uri.UriSchemeHttp ||
                        uri.Scheme == Uri.UriSchemeHttps),
                "A valid WCF HTTP/HTTPS endpoint URL is required.")
            .ValidateOnStart();

        // WCF client
        services.AddTransient<IWcfMonitorClient, WcfMonitorClient>();

        // Exception handling
        services.AddExceptionHandler<GlobalExceptionHandler>();
        services.AddProblemDetails();

        // MVC controllers
        services.AddControllers();

        return services;
    }
}
