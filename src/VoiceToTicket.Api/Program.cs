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

app.MapHealthEndpoints();
app.MapGenerateTicketEndpoint();

app.Run();

public partial class Program;
