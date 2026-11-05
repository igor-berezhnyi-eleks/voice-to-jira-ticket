using VoiceToTicket.Api.Features.Health;
using VoiceToTicket.Api.Infrastructure;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddApiErrorHandling();
builder.Services.AddApiDocumentation();

var app = builder.Build();

app.UseExceptionHandler();
app.UseStatusCodePages();
app.UseApiDocumentation();

app.MapHealthEndpoints();

app.Run();

public partial class Program;
