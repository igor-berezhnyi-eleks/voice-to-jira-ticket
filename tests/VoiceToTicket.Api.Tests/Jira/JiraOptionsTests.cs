using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using VoiceToTicket.Api.Features.Jira;

namespace VoiceToTicket.Api.Tests.Jira;

/// <summary>Jira settings through real configuration binding and the real <c>ValidateOnStart</c> registration.</summary>
public sealed class JiraOptionsTests
{
    [Fact]
    public void Defaults_match_the_plan()
    {
        var options = Bind([]);

        Assert.False(options.Enabled);
        Assert.Null(options.BaseUrl);
        Assert.Null(options.DefaultProjectKey);
        Assert.Equal("Relates", options.DefaultLinkType);
        Assert.Equal(15, options.TimeoutSeconds);
        Assert.Equal(8, options.SessionHours);
        Assert.Equal(["Bug", "Defect"], options.PreferredIssueTypes.BugNames);
        Assert.Equal(["Story", "Feature", "Task"], options.PreferredIssueTypes.FeatureNames);
    }

    [Fact]
    public void A_configured_list_replaces_the_default_instead_of_adding_to_it()
    {
        var options = Bind(new()
        {
            ["Jira:PreferredIssueTypes:Bug:0"] = "Incident",
            ["Jira:PreferredIssueTypes:Feature:0"] = "Epic",
            ["Jira:PreferredIssueTypes:Feature:1"] = "Story",
        });

        Assert.Equal(["Incident"], options.PreferredIssueTypes.BugNames);
        Assert.Equal(["Epic", "Story"], options.PreferredIssueTypes.FeatureNames);
    }

    [Fact]
    public void An_empty_configured_value_means_no_preference()
    {
        // An empty array cannot be written in configuration, but an empty value (for example the environment
        // variable Jira__PreferredIssueTypes__Bug=) is how a user says "none".
        var options = Bind(new() { ["Jira:PreferredIssueTypes:Bug"] = "" });

        Assert.Empty(options.PreferredIssueTypes.BugNames);
        Assert.Equal(["Story", "Feature", "Task"], options.PreferredIssueTypes.FeatureNames);
    }

    [Fact]
    public void A_list_with_only_blank_names_means_no_preference()
    {
        var options = Bind(new() { ["Jira:PreferredIssueTypes:Bug:0"] = " " });

        Assert.Empty(options.PreferredIssueTypes.BugNames);
    }

    [Fact]
    public void Disabled_Jira_is_not_validated()
    {
        using var provider = Provider(new() { ["Jira:Enabled"] = "false", ["Jira:BaseUrl"] = "not a url", ["Jira:TimeoutSeconds"] = "0" });

        Assert.False(provider.GetRequiredService<IOptions<JiraOptions>>().Value.Enabled);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("not a url")]
    [InlineData("/relative")]
    [InlineData("http://example.atlassian.net")]
    [InlineData("ftp://example.atlassian.net")]
    public void Enabled_Jira_needs_an_absolute_https_base_url(string? baseUrl)
    {
        var settings = new Dictionary<string, string?> { ["Jira:Enabled"] = "true" };
        if (baseUrl is not null)
        {
            settings["Jira:BaseUrl"] = baseUrl;
        }

        using var provider = Provider(settings);

        var exception = Assert.Throws<OptionsValidationException>(() => provider.GetRequiredService<IOptions<JiraOptions>>().Value);
        Assert.Contains("https", exception.Message);
    }

    [Theory]
    [InlineData("Jira:TimeoutSeconds", "0")]
    [InlineData("Jira:SessionHours", "0")]
    public void Enabled_Jira_needs_positive_timeout_and_session_hours(string key, string value)
    {
        using var provider = Provider(new() { ["Jira:Enabled"] = "true", ["Jira:BaseUrl"] = "https://example.atlassian.net", [key] = value });

        Assert.Throws<OptionsValidationException>(() => provider.GetRequiredService<IOptions<JiraOptions>>().Value);
    }

    [Fact]
    public void Enabled_Jira_with_an_https_base_url_is_valid_and_the_other_keys_are_optional()
    {
        using var provider = Provider(new() { ["Jira:Enabled"] = "true", ["Jira:BaseUrl"] = "https://example.atlassian.net/" });

        var options = provider.GetRequiredService<IOptions<JiraOptions>>().Value;

        Assert.Equal("https://example.atlassian.net", options.SiteUrl);
    }

    private static JiraOptions Bind(Dictionary<string, string?> settings)
    {
        using var provider = Provider(settings);
        return provider.GetRequiredService<IOptions<JiraOptions>>().Value;
    }

    private static ServiceProvider Provider(Dictionary<string, string?> settings)
    {
        var configuration = new ConfigurationBuilder().AddInMemoryCollection(settings).Build();
        return new ServiceCollection()
            .AddLogging()
            .AddSingleton(TimeProvider.System)
            .AddSingleton<IConfiguration>(configuration)
            .AddJira(configuration)
            .BuildServiceProvider();
    }
}
