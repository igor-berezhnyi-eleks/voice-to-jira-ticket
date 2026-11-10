using VoiceToJira.Api.Common;
using VoiceToJira.Api.Features.Jira;
using VoiceToJira.Api.Features.Tickets;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddOptions<ClaudeOptions>()
    .BindConfiguration(ClaudeOptions.SectionName)
    .ValidateDataAnnotations()
    .Validate(o => Enum.TryParse<Anthropic.Models.Beta.Messages.Effort>(o.Effort, ignoreCase: true, out _), "Claude:Effort must be low, medium, high, xhigh or max.")
    .ValidateOnStart();

builder.Services.AddHttpClient(ClaudeTicketGenerator.HttpClientName);
builder.Services.AddScoped<ITicketGenerator, ClaudeTicketGenerator>();

builder.Services.AddOptions<JiraOptions>().BindConfiguration(JiraOptions.SectionName);

builder.Services.AddHttpClient<JiraClient>(client => client.Timeout = TimeSpan.FromSeconds(30));
builder.Services.AddDataProtection();
builder.Services.AddSingleton<JiraSession>();

builder.Services.AddSingleton(TimeProvider.System);
builder.Services.AddProblemDetails();
builder.Services.AddExceptionHandler<GlobalExceptionHandler>();
builder.Services.AddHealthChecks();
builder.Services.AddOpenApi();

var app = builder.Build();

app.UseExceptionHandler();
app.UseStatusCodePages();

app.MapOpenApi();
app.UseSwaggerUI(o => o.SwaggerEndpoint("/openapi/v1.json", "VoiceToJira API v1"));

// The built SPA is served from wwwroot (copied in by the Dockerfile; in development Vite serves it).
app.UseDefaultFiles();
app.UseStaticFiles();

var api = app.MapGroup("/api");
api.MapHealthChecks("/health");
api.MapTicketEndpoints();
api.MapJiraEndpoints();

// Unknown /api routes return 404 instead of falling through to the SPA.
app.MapFallback("/api/{**path}", () => TypedResults.NotFound());
app.MapFallbackToFile("index.html");

app.Run();
