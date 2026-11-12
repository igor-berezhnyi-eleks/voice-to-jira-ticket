using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Options;

namespace VoiceToTicket.Api.Features.Jira;

public static class JiraServiceCollectionExtensions
{
    /// <summary>Registers the Jira client, options, session cookie and the extra ProblemDetails behaviour.</summary>
    /// <param name="configuration">Read for <c>DataProtection:KeysPath</c>: keys are kept in memory when it is not set.</param>
    public static IServiceCollection AddJira(this IServiceCollection services, IConfiguration configuration)
    {
        // With Jira off nothing is validated, so the app starts as before.
        services.AddOptions<JiraOptions>()
            .BindConfiguration(JiraOptions.SectionName)
            .Validate(options => options.IsValid(), JiraOptions.InvalidMessage)
            .ValidateOnStart();

        var keysPath = configuration["DataProtection:KeysPath"];
        var dataProtection = services.AddDataProtection().SetApplicationName("VoiceToTicket");
        if (!string.IsNullOrWhiteSpace(keysPath))
        {
            dataProtection.PersistKeysToFileSystem(new DirectoryInfo(keysPath));
        }

        services.AddSingleton<JiraSession>();
        services.AddHttpClient<IJiraClient, JiraClient>((serviceProvider, client) =>
        {
            var options = serviceProvider.GetRequiredService<IOptions<JiraOptions>>().Value;
            if (options.Enabled)
            {
                client.BaseAddress = new Uri(options.SiteUrl + "/");
            }

            client.Timeout = Timeout.InfiniteTimeSpan; // JiraClient enforces Jira:TimeoutSeconds itself.
        });

        // A failed Jira call carries extra fields (errors, errorMessages, retryAfterSeconds), and a 401 on a call
        // made with the session ends the session. Done here so the shared exception handler stays generic.
        services.PostConfigure<Microsoft.AspNetCore.Http.ProblemDetailsOptions>(options =>
        {
            var previous = options.CustomizeProblemDetails;
            options.CustomizeProblemDetails = context =>
            {
                previous?.Invoke(context);
                if (context.Exception is not JiraApiException exception)
                {
                    return;
                }

                foreach (var (name, value) in exception.Extensions)
                {
                    context.ProblemDetails.Extensions[name] = value;
                }

                if (exception.Code == Infrastructure.ErrorCodes.JiraAuthRequired)
                {
                    context.HttpContext.RequestServices.GetRequiredService<JiraSession>().Clear(context.HttpContext);
                }
            };
        });

        return services;
    }
}
