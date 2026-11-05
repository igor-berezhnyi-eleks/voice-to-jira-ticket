namespace VoiceToTicket.Api.Infrastructure;

public static class ErrorHandlingExtensions
{
    /// <summary>
    /// Every ProblemDetails response carries a <c>code</c> (plan 4.4): exceptions set it in
    /// <see cref="ProblemDetailsExceptionHandler"/>; anything else written through
    /// <see cref="IProblemDetailsService"/> (status code pages for 404/405, framework validation)
    /// gets the default code for its status.
    /// </summary>
    public static IServiceCollection AddApiErrorHandling(this IServiceCollection services)
    {
        services.AddProblemDetails(options => options.CustomizeProblemDetails = context =>
        {
            var extensions = context.ProblemDetails.Extensions;
            if (!extensions.ContainsKey(ErrorCodes.ExtensionName))
            {
                var status = context.ProblemDetails.Status ?? context.HttpContext.Response.StatusCode;
                extensions[ErrorCodes.ExtensionName] = ErrorCodes.ForStatus(status);
            }
        });
        services.AddExceptionHandler<ProblemDetailsExceptionHandler>();
        return services;
    }
}
