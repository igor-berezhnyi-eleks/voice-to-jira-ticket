namespace VoiceToTicket.Api.Infrastructure;

/// <summary>
/// The path prefix the app is served under (deployment plan D28): empty locally, <c>/alt</c> on the shared VM, where
/// the colleague's Caddy forwards <c>/alt/*</c> without stripping it. Read from the top-level key <c>PathBase</c>.
/// </summary>
public sealed class PathBaseOptions
{
    public const string InvalidMessage =
        "PathBase must be empty or start with '/', not end with '/', and contain no '?', '#', '\\' or empty segment (for example /alt).";

    public string PathBase { get; set; } = "";

    public bool IsValid() =>
        PathBase.Length == 0
        || (PathBase.StartsWith('/')
            && !PathBase.EndsWith('/')
            && !PathBase.Contains("//", StringComparison.Ordinal)
            && PathBase.IndexOfAny(['?', '#', '\\']) < 0);
}

public static class PathBaseExtensions
{
    public static IServiceCollection AddPathBase(this IServiceCollection services, IConfiguration configuration)
    {
        services.AddOptions<PathBaseOptions>()
            .Configure(options => options.PathBase = configuration[nameof(PathBaseOptions.PathBase)] ?? "")
            .Validate(options => options.IsValid(), PathBaseOptions.InvalidMessage)
            .ValidateOnStart();
        return services;
    }
}
