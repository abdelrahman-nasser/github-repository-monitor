using GitHubMonitor.Application.Abstractions;
using GitHubMonitor.Application.UseCases;
using GitHubMonitor.Infrastructure.GitHub;
using Microsoft.Extensions.Options;

namespace GitHubMonitor.Wcf.Host.Extensions;

public static class ServiceCollectionExtensions
{
    public static IServiceCollection AddGitHubIntegration(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        // GitHub configuration
        services.AddOptions<GitHubOptions>()
            .Bind(configuration.GetSection(GitHubOptions.SectionName))
            .Validate(
                options =>
                    !string.IsNullOrWhiteSpace(options.Owner) &&
                    !string.IsNullOrWhiteSpace(options.Repository) &&
                    !string.IsNullOrWhiteSpace(options.Token),
                "GitHub owner, repository and token are required.")
            .ValidateOnStart();

        // Provide validated options to the GitHub client
        services.AddSingleton(sp =>
            sp.GetRequiredService<IOptions<GitHubOptions>>().Value);

        // GitHub HTTP client
        services.AddHttpClient<
            IGitHubCommitProvider,
            GitHubCommitProvider>(client =>
            {
                client.Timeout = TimeSpan.FromSeconds(15);
            });

        // Application use cases
        services.AddTransient<GetLiveCommitsUseCase>();

        return services;
    }
}
