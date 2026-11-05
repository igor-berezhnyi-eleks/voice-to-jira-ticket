namespace VoiceToTicket.Api.Infrastructure;

/// <summary>Values of the ProblemDetails <c>code</c> extension (plan section 4.4).</summary>
public static class ErrorCodes
{
    public const string ExtensionName = "code";

    public const string InternalError = "internal_error";
    public const string Validation = "validation";
    public const string NotFound = "not_found";
    public const string MethodNotAllowed = "method_not_allowed";
    public const string PayloadTooLarge = "payload_too_large";
    public const string UnsupportedMediaType = "unsupported_media_type";

    /// <summary>Fallback for a client error status that has no more specific code.</summary>
    public const string HttpError = "http_error";

    /// <summary>The code used when an error response does not set one itself.</summary>
    public static string ForStatus(int statusCode) => statusCode switch
    {
        StatusCodes.Status400BadRequest => Validation,
        StatusCodes.Status404NotFound => NotFound,
        StatusCodes.Status405MethodNotAllowed => MethodNotAllowed,
        StatusCodes.Status413PayloadTooLarge => PayloadTooLarge,
        StatusCodes.Status415UnsupportedMediaType => UnsupportedMediaType,
        >= 500 => InternalError,
        _ => HttpError,
    };
}
