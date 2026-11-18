using System.Text.Json;
using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using VoiceToJira.Api.Common;

namespace VoiceToJira.Tests.Common;

public sealed class GlobalExceptionHandlerTests
{
    [Fact]
    public async Task Unhandled_exception_becomes_500_problem_details_without_leaking_the_message()
    {
        var services = new ServiceCollection().AddLogging().AddProblemDetails().BuildServiceProvider();
        var context = new DefaultHttpContext { RequestServices = services };
        context.Response.Body = new MemoryStream();
        var handler = new GlobalExceptionHandler(
            services.GetRequiredService<IProblemDetailsService>(),
            NullLogger<GlobalExceptionHandler>.Instance);

        var handled = await handler.TryHandleAsync(context, new InvalidOperationException("secret detail"), TestContext.Current.CancellationToken);

        handled.Should().BeTrue();
        context.Response.StatusCode.Should().Be(StatusCodes.Status500InternalServerError);
        context.Response.Body.Position = 0;
        using var body = await JsonDocument.ParseAsync(context.Response.Body, cancellationToken: TestContext.Current.CancellationToken);
        body.RootElement.GetProperty("title").GetString().Should().Be("An unexpected error occurred.");
        body.RootElement.GetRawText().Should().NotContain("secret detail");
    }
}
