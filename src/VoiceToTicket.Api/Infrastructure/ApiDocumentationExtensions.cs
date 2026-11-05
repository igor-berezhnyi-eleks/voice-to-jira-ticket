namespace VoiceToTicket.Api.Infrastructure;

public static class ApiDocumentationExtensions
{
    public const string OpenApiDocumentPath = "/openapi/v1.json";

    public static IServiceCollection AddApiDocumentation(this IServiceCollection services)
    {
        services.AddOpenApi();
        return services;
    }

    /// <summary>OpenAPI document in every environment; Swagger UI at <c>/swagger</c> in Development only.</summary>
    public static WebApplication UseApiDocumentation(this WebApplication app)
    {
        app.MapOpenApi();

        if (app.Environment.IsDevelopment())
        {
            app.UseSwaggerUI(options =>
            {
                options.SwaggerEndpoint(OpenApiDocumentPath, "VoiceToTicket API v1");
                options.RoutePrefix = "swagger";
            });
        }

        return app;
    }
}
