namespace VoiceToTicket.Evaluation;

/// <summary>Finds the repository root by walking up from the test binaries to the solution file.</summary>
public static class RepoPaths
{
    public static string Root { get; } = FindRoot();

    public static string Scenarios => Path.Combine(Root, "eval", "scenarios");

    public static string Results => Path.Combine(Root, "eval", "results");

    private static string FindRoot()
    {
        for (var directory = new DirectoryInfo(AppContext.BaseDirectory); directory is not null; directory = directory.Parent)
        {
            if (directory.GetFiles("*.slnx").Length > 0)
            {
                return directory.FullName;
            }
        }

        throw new InvalidOperationException("Could not find the repository root (no .slnx file above " + AppContext.BaseDirectory + ").");
    }
}
