using System.Text.Json.Serialization;
using VoiceToTicket.Api.Features.Health;
using VoiceToTicket.Api.Features.Tickets;
using VoiceToTicket.Api.Features.Tickets.Contract;
using VoiceToTicket.Api.Infrastructure;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddApiErrorHandling();
builder.Services.AddApiDocumentation();
builder.Services.AddValidation();
builder.Services.ConfigureHttpJsonOptions(options =>
    options.SerializerOptions.Converters.Add(new JsonStringEnumConverter<TicketType>(allowIntegerValues: false)));

builder.Services.AddSingleton(TimeProvider.System);
builder.Services.AddOptions<TicketGeneratorOptions>()
    .BindConfiguration(TicketGeneratorOptions.SectionName)
    .Validate(options => options.HasKnownProvider(), TicketGeneratorOptions.InvalidProviderMessage)
    .ValidateOnStart();
builder.Services.AddSingleton<ITicketGenerator, FakeTicketGenerator>();

var app = builder.Build();

app.UseExceptionHandler();
app.UseStatusCodePages();
app.UseApiDocumentation();
app.UseRouting();

// Client paths get the SPA. This runs after routing, not as a fallback endpoint, because a fallback
// endpoint changes the API's answers: 405 for an unknown POST route, 404 for GET on a POST-only route.
app.Use((context, next) =>
{
    var request = context.Request;
    var isReadRequest = HttpMethods.IsGet(request.Method) || HttpMethods.IsHead(request.Method);
    var isApiPath = request.Path.StartsWithSegments("/api") || request.Path.StartsWithSegments("/health");
    if (context.GetEndpoint() is null && isReadRequest && !isApiPath && !Path.HasExtension(request.Path.Value))
    {
        request.Path = "/index.html";
    }

    return next(context);
});
app.UseStaticFiles();

app.MapHealthEndpoints();
app.MapGenerateTicketEndpoint();

app.Run();

public partial class Program;
