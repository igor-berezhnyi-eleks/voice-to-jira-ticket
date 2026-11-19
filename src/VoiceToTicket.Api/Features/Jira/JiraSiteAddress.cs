namespace VoiceToTicket.Api.Features.Jira;

/// <summary>
/// The Jira address a user types, and the allowlist it is checked against (jira-plan section 3, J9). The API calls
/// only hosts that match <c>Jira:AllowedHosts</c>, so it cannot be pointed at an arbitrary or internal host.
/// A pattern is an exact host (<c>jira.company.com</c>) or a leading wildcard (<c>*.atlassian.net</c>, which needs
/// at least one label before the suffix). The host is compared; the port and path are not.
/// </summary>
public static class JiraSiteAddress
{
    private const int MaxLength = 2048;
    private const string WildcardPrefix = "*.";

    /// <summary>
    /// The address as <c>https://host[:port][/path]</c> (lowercase host, default port and trailing slashes dropped), or
    /// null when it is not a plain https address: another scheme, user info, a query or fragment, or no host.
    /// </summary>
    public static string? Normalize(string? input)
    {
        var text = input?.Trim();
        if (string.IsNullOrEmpty(text)
            || text.Length > MaxLength
            || text.AsSpan().ContainsAny("?#@\\")
            || !Uri.TryCreate(text, UriKind.Absolute, out var uri)
            || uri.Scheme != Uri.UriSchemeHttps
            || uri.UserInfo.Length > 0
            || uri.Query.Length > 0
            || uri.Fragment.Length > 0
            || uri.Host.Length == 0)
        {
            return null;
        }

        var host = uri.HostNameType == UriHostNameType.Dns ? uri.IdnHost : uri.Host;
        var port = uri.IsDefaultPort ? "" : $":{uri.Port}";
        return $"https://{host}{port}{uri.AbsolutePath.TrimEnd('/')}";
    }

    /// <summary>The normalized address when it is allowed by <paramref name="patterns"/>, otherwise null.</summary>
    public static string? Resolve(string? input, IEnumerable<string> patterns)
    {
        var normalized = Normalize(input);
        return normalized is not null && IsAllowed(normalized, patterns) ? normalized : null;
    }

    /// <summary>True when the host of <paramref name="address"/> matches one of <paramref name="patterns"/>.</summary>
    public static bool IsAllowed(string address, IEnumerable<string> patterns)
    {
        var host = Normalize(address) is { } normalized ? new Uri(normalized).Host : null;
        return host is not null && patterns.Any(pattern => HostMatches(host, pattern));
    }

    public static bool HostMatches(string host, string pattern)
    {
        if (!IsValidPattern(pattern))
        {
            return false;
        }

        pattern = pattern.Trim();
        if (!pattern.StartsWith(WildcardPrefix, StringComparison.Ordinal))
        {
            return host.Equals(pattern, StringComparison.OrdinalIgnoreCase);
        }

        // "*.atlassian.net" needs a label in front of ".atlassian.net": the bare domain does not match.
        var suffix = pattern[1..];
        return host.Length > suffix.Length && host.EndsWith(suffix, StringComparison.OrdinalIgnoreCase);
    }

    /// <summary>An exact host or <c>*.suffix</c>: no scheme, port, path or other wildcard.</summary>
    public static bool IsValidPattern(string? pattern)
    {
        var text = pattern?.Trim();
        if (string.IsNullOrEmpty(text))
        {
            return false;
        }

        var name = text.StartsWith(WildcardPrefix, StringComparison.Ordinal) ? text[WildcardPrefix.Length..] : text;
        return name.Length > 0
            && !name.StartsWith('.')
            && !name.EndsWith('.')
            && !name.Contains("..", StringComparison.Ordinal)
            && name.All(character => char.IsAsciiLetterOrDigit(character) || character is '-' or '.' or '_');
    }
}
