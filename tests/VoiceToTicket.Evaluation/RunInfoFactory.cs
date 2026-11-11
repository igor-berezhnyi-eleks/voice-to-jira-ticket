using System.Diagnostics;
using System.Security.Cryptography;
using System.Text;
using VoiceToTicket.Api.Features.Tickets.Claude;

namespace VoiceToTicket.Evaluation;

public static class RunInfoFactory
{
    /// <summary>The tag the scenarios were frozen under (plan 6, T5.1).</summary>
    public const string ScenarioVersion = "eval-scenarios-v1";

    public static string PromptHash() =>
        Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(TicketPrompt.System))).ToLowerInvariant();

    public static RunInfo Create(ScenarioSet scenarios, DateTimeOffset startedAt)
    {
        var commit = Git("rev-parse --short HEAD") ?? "unknown";
        var dirty = !string.IsNullOrWhiteSpace(Git("status --porcelain --untracked-files=no"));
        return new RunInfo(ScenarioVersion, scenarios.Hash, PromptHash(), commit, dirty, startedAt);
    }

    private static string? Git(string arguments)
    {
        try
        {
            using var process = Process.Start(new ProcessStartInfo("git", arguments)
            {
                WorkingDirectory = RepoPaths.Root,
                RedirectStandardOutput = true,
                RedirectStandardError = true,
            });
            if (process is null)
            {
                return null;
            }

            var output = process.StandardOutput.ReadToEnd().Trim();
            process.WaitForExit();
            return process.ExitCode == 0 ? output : null;
        }
        catch (Exception exception) when (exception is System.ComponentModel.Win32Exception or InvalidOperationException)
        {
            return null;
        }
    }
}
