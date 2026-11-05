using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using VoiceToTicket.Api.Infrastructure;

namespace VoiceToTicket.Api.Tests.Infrastructure;

public sealed class ProblemDetailsExceptionHandlerTests
{
    [Fact]
    public async Task Unknown_exception_becomes_500_internal_error_without_exception_details()
    {
        const string secret = "Sensitive message: Password=hunter2";
        var exception = Thrown(new InvalidOperationException(secret));

        var (handled, context, body) = await HandleAsync(exception);

        Assert.True(handled);
        Assert.Equal(StatusCodes.Status500InternalServerError, context.Response.StatusCode);
        Assert.Equal("application/problem+json", context.Response.ContentType);
        var root = body.RootElement;
        Assert.Equal(500, root.GetProperty("status").GetInt32());
        Assert.Equal(ErrorCodes.InternalError, root.GetProperty("code").GetString());
        var raw = root.GetRawText();
        Assert.DoesNotContain("hunter2", raw);
        Assert.DoesNotContain(nameof(InvalidOperationException), raw);
        Assert.DoesNotContain(nameof(Thrown), raw); // no stack trace frames
        Assert.False(root.TryGetProperty("exception", out _));
        Assert.False(root.TryGetProperty("detail", out _));
    }

    [Fact]
    public async Task Api_exception_maps_to_its_status_and_code()
    {
        var exception = Thrown(new ApiException(
            StatusCodes.Status503ServiceUnavailable,
            "stt_unavailable",
            "Speech-to-text is unavailable.",
            "Try again in a minute.",
            new HttpRequestException("internal host stt:8000 refused")));

        var (handled, context, body) = await HandleAsync(exception);

        Assert.True(handled);
        Assert.Equal(StatusCodes.Status503ServiceUnavailable, context.Response.StatusCode);
        var root = body.RootElement;
        Assert.Equal(503, root.GetProperty("status").GetInt32());
        Assert.Equal("stt_unavailable", root.GetProperty("code").GetString());
        Assert.Equal("Speech-to-text is unavailable.", root.GetProperty("title").GetString());
        Assert.Equal("Try again in a minute.", root.GetProperty("detail").GetString());
        Assert.DoesNotContain("stt:8000", root.GetRawText());
    }

    private static Exception Thrown(Exception exception)
    {
        try
        {
            throw exception;
        }
        catch (Exception thrown)
        {
            return thrown;
        }
    }

    private static async Task<(bool Handled, HttpContext Context, JsonDocument Body)> HandleAsync(Exception exception)
    {
        var services = new ServiceCollection()
            .AddLogging()
            .AddProblemDetails()
            .BuildServiceProvider();
        var context = new DefaultHttpContext { RequestServices = services };
        context.Request.Headers.Accept = "application/json";
        var responseBody = new MemoryStream();
        context.Response.Body = responseBody;

        var handler = new ProblemDetailsExceptionHandler(
            services.GetRequiredService<IProblemDetailsService>(),
            NullLogger<ProblemDetailsExceptionHandler>.Instance);

        var handled = await handler.TryHandleAsync(context, exception, TestContext.Current.CancellationToken);

        responseBody.Position = 0;
        var body = await JsonDocument.ParseAsync(responseBody, cancellationToken: TestContext.Current.CancellationToken);
        return (handled, context, body);
    }
}
