using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.WebUtilities;

namespace VoiceToTicket.Api.Infrastructure;

/// <summary>
/// The single place where exceptions become ProblemDetails responses with a <c>code</c> extension.
/// Unknown exceptions become a 500 <c>internal_error</c> without exception details in the body.
/// </summary>
public sealed class ProblemDetailsExceptionHandler(
    IProblemDetailsService problemDetailsService,
    ILogger<ProblemDetailsExceptionHandler> logger) : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(
        HttpContext httpContext,
        Exception exception,
        CancellationToken cancellationToken)
    {
        ProblemDetails problem;
        if (exception is ApiException apiException)
        {
            logger.LogWarning(exception, "Request failed with {Code} ({StatusCode})", apiException.Code, apiException.StatusCode);
            problem = new ProblemDetails
            {
                Status = apiException.StatusCode,
                Title = apiException.Title,
                Detail = apiException.Detail,
            };
            problem.Extensions[ErrorCodes.ExtensionName] = apiException.Code;
        }
        else if (exception is BadHttpRequestException badRequest)
        {
            // Thrown by the server for malformed or oversized requests (e.g. body over the size limit → 413).
            // A client error, not a server failure: keep its status; the code comes from the status.
            logger.LogInformation("Bad request rejected with {StatusCode}", badRequest.StatusCode);
            problem = new ProblemDetails
            {
                Status = badRequest.StatusCode,
                Title = ReasonPhrases.GetReasonPhrase(badRequest.StatusCode),
            };
            problem.Extensions[ErrorCodes.ExtensionName] = ErrorCodes.ForStatus(badRequest.StatusCode);
        }
        else
        {
            logger.LogError(exception, "Unhandled exception");
            problem = new ProblemDetails
            {
                Status = StatusCodes.Status500InternalServerError,
                Title = "An unexpected error occurred.",
            };
            problem.Extensions[ErrorCodes.ExtensionName] = ErrorCodes.InternalError;
        }

        httpContext.Response.StatusCode = problem.Status.Value;

        return await problemDetailsService.TryWriteAsync(new ProblemDetailsContext
        {
            HttpContext = httpContext,
            ProblemDetails = problem,
            Exception = exception,
        });
    }
}
