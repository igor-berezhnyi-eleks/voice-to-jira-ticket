using VoiceToTicket.Api.Features.Jira;

namespace VoiceToTicket.Api.Tests.Jira;

/// <summary>The address the user types: normalized, https only, and only hosts on the allowlist (J9).</summary>
public sealed class JiraSiteAddressTests
{
    [Theory]
    [InlineData("https://example.atlassian.net", "https://example.atlassian.net")]
    [InlineData("  https://example.atlassian.net/  ", "https://example.atlassian.net")]
    [InlineData("HTTPS://Example.Atlassian.NET", "https://example.atlassian.net")]
    [InlineData("https://jira.company.com:8443", "https://jira.company.com:8443")]
    [InlineData("https://jira.company.com:443", "https://jira.company.com")]
    [InlineData("https://jira.company.com/jira", "https://jira.company.com/jira")]
    [InlineData("https://jira.company.com/jira///", "https://jira.company.com/jira")]
    public void Normalizes_a_valid_address(string input, string expected)
    {
        Assert.Equal(expected, JiraSiteAddress.Normalize(input));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("example.atlassian.net")]
    [InlineData("http://example.atlassian.net")]
    [InlineData("ftp://example.atlassian.net")]
    [InlineData("https://user@example.atlassian.net")]
    [InlineData("https://user:pw@example.atlassian.net")]
    [InlineData("https://example.atlassian.net?x=1")]
    [InlineData("https://example.atlassian.net#top")]
    [InlineData("https://example.atlassian.net/a?x=1")]
    [InlineData("https://")]
    [InlineData("not a url")]
    public void Rejects_an_address_that_is_not_plain_https(string? input)
    {
        Assert.Null(JiraSiteAddress.Normalize(input));
    }

    [Fact]
    public void Rejects_an_address_over_the_length_limit()
    {
        Assert.Null(JiraSiteAddress.Normalize("https://example.atlassian.net/" + new string('a', 3000)));
    }

    [Theory]
    [InlineData("jira.company.com", "jira.company.com", true)]
    [InlineData("JIRA.company.com", "jira.company.com", true)]
    [InlineData("jira.company.com", "other.company.com", false)]
    [InlineData("sub.jira.company.com", "jira.company.com", false)]
    [InlineData("example.atlassian.net", "*.atlassian.net", true)]
    [InlineData("a.b.atlassian.net", "*.atlassian.net", true)]
    [InlineData("atlassian.net", "*.atlassian.net", false)]
    [InlineData("evilatlassian.net", "*.atlassian.net", false)]
    [InlineData("atlassian.net.evil.com", "*.atlassian.net", false)]
    [InlineData("example.atlassian.net.", "*.atlassian.net", false)]
    [InlineData("127.0.0.1", "*.atlassian.net", false)]
    [InlineData("localhost", "*.atlassian.net", false)]
    public void Matches_a_host_against_one_pattern(string host, string pattern, bool expected)
    {
        Assert.Equal(expected, JiraSiteAddress.HostMatches(host, pattern));
    }

    [Theory]
    [InlineData("*")]
    [InlineData("*.")]
    [InlineData("**.atlassian.net")]
    [InlineData("jira.*.com")]
    [InlineData("https://jira.company.com")]
    [InlineData("jira.company.com/path")]
    [InlineData("jira.company.com:8443")]
    [InlineData("")]
    [InlineData(" ")]
    public void A_malformed_pattern_matches_nothing_and_is_not_valid(string pattern)
    {
        Assert.False(JiraSiteAddress.IsValidPattern(pattern));
        Assert.False(JiraSiteAddress.HostMatches("jira.company.com", pattern));
        Assert.False(JiraSiteAddress.HostMatches("anything.atlassian.net", pattern));
    }

    [Theory]
    [InlineData("jira.company.com")]
    [InlineData("*.atlassian.net")]
    [InlineData("localhost")]
    [InlineData("10.0.0.5")]
    public void Valid_patterns(string pattern)
    {
        Assert.True(JiraSiteAddress.IsValidPattern(pattern));
    }

    [Theory]
    [InlineData("https://127.0.0.1")]
    [InlineData("https://localhost")]
    [InlineData("https://[::1]")]
    [InlineData("https://10.0.0.5")]
    [InlineData("https://169.254.169.254")]
    public void Internal_hosts_are_only_allowed_when_listed_exactly(string address)
    {
        Assert.False(JiraSiteAddress.IsAllowed(address, ["*.atlassian.net", "jira.company.com"]));
    }

    [Fact]
    public void An_internal_host_that_is_listed_exactly_is_allowed()
    {
        Assert.True(JiraSiteAddress.IsAllowed("https://localhost:9443", ["localhost"]));
        Assert.True(JiraSiteAddress.IsAllowed("https://10.0.0.5", ["10.0.0.5"]));
    }

    [Fact]
    public void Is_allowed_compares_the_host_only_not_the_path()
    {
        Assert.True(JiraSiteAddress.IsAllowed("https://jira.company.com:8443/jira", ["jira.company.com"]));
        Assert.False(JiraSiteAddress.IsAllowed("https://evil.com/jira.company.com", ["jira.company.com"]));
    }

    [Fact]
    public void Nothing_is_allowed_by_an_empty_list()
    {
        Assert.False(JiraSiteAddress.IsAllowed("https://jira.company.com", []));
    }

    [Fact]
    public void Resolve_returns_the_normalized_address_only_when_allowed()
    {
        string[] allowed = ["*.atlassian.net"];

        Assert.Equal("https://example.atlassian.net", JiraSiteAddress.Resolve(" https://Example.atlassian.net/ ", allowed));
        Assert.Null(JiraSiteAddress.Resolve("https://example.com", allowed));
        Assert.Null(JiraSiteAddress.Resolve("http://example.atlassian.net", allowed));
        Assert.Null(JiraSiteAddress.Resolve(null, allowed));
    }
}
