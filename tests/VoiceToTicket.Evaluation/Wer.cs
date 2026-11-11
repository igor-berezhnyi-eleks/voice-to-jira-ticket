using System.Text;

namespace VoiceToTicket.Evaluation;

/// <summary>Word-level edit counts between a reference and a transcript. <see cref="Rate"/> is null when the reference has no words.</summary>
public sealed record WerResult(int ReferenceWords, int Substitutions, int Deletions, int Insertions)
{
    public int Errors => Substitutions + Deletions + Insertions;

    public double? Rate => ReferenceWords == 0 ? null : (double)Errors / ReferenceWords;
}

/// <summary>
/// Word error rate (plan T5.3): (substitutions + deletions + insertions) / words in the reference. Case and punctuation
/// are ignored; apostrophes inside words and dots between digits are kept (<c>it's</c>, <c>3.8</c>). Number words are
/// not converted, so "three" against "3" is one error.
/// </summary>
public static class Wer
{
    public static WerResult Compute(string reference, string hypothesis)
    {
        var expected = Words(reference);
        var actual = Words(hypothesis);

        // cost[i, j] = fewest edits turning the first i reference words into the first j transcript words.
        var cost = new int[expected.Count + 1, actual.Count + 1];
        for (var i = 1; i <= expected.Count; i++)
        {
            cost[i, 0] = i;
        }

        for (var j = 1; j <= actual.Count; j++)
        {
            cost[0, j] = j;
        }

        for (var i = 1; i <= expected.Count; i++)
        {
            for (var j = 1; j <= actual.Count; j++)
            {
                var same = expected[i - 1] == actual[j - 1] ? 0 : 1;
                cost[i, j] = Math.Min(cost[i - 1, j - 1] + same, Math.Min(cost[i - 1, j] + 1, cost[i, j - 1] + 1));
            }
        }

        // Walk back from the end; on a tie prefer match/substitution, then deletion, then insertion, so the split is stable.
        int substitutions = 0, deletions = 0, insertions = 0;
        int row = expected.Count, column = actual.Count;
        while (row > 0 || column > 0)
        {
            if (row > 0 && column > 0)
            {
                var same = expected[row - 1] == actual[column - 1] ? 0 : 1;
                if (cost[row, column] == cost[row - 1, column - 1] + same)
                {
                    substitutions += same;
                    row--;
                    column--;
                    continue;
                }
            }

            if (row > 0 && cost[row, column] == cost[row - 1, column] + 1)
            {
                deletions++;
                row--;
            }
            else
            {
                insertions++;
                column--;
            }
        }

        return new WerResult(expected.Count, substitutions, deletions, insertions);
    }

    /// <summary>The pooled rate over several scenarios: all errors over all reference words, not an average of ratios.</summary>
    public static double? Pooled(IEnumerable<WerResult> results)
    {
        int words = 0, errors = 0;
        foreach (var result in results)
        {
            words += result.ReferenceWords;
            errors += result.Errors;
        }

        return words == 0 ? null : (double)errors / words;
    }

    public static IReadOnlyList<string> Words(string text)
    {
        var words = new List<string>();
        var word = new StringBuilder();
        for (var i = 0; i < text.Length; i++)
        {
            var c = text[i];
            if (char.IsLetterOrDigit(c))
            {
                word.Append(char.ToLowerInvariant(c));
            }
            else if (word.Length > 0 && IsJoiner(text, i))
            {
                word.Append(c == '’' ? '\'' : c);
            }
            else if (word.Length > 0)
            {
                words.Add(word.ToString());
                word.Clear();
            }
        }

        if (word.Length > 0)
        {
            words.Add(word.ToString());
        }

        return words;
    }

    // An apostrophe between letters, or a dot between digits, stays inside the word.
    private static bool IsJoiner(string text, int index)
    {
        if (index + 1 >= text.Length)
        {
            return false;
        }

        var before = text[index - 1];
        var after = text[index + 1];
        return text[index] switch
        {
            '\'' or '’' => char.IsLetter(before) && char.IsLetter(after),
            '.' => char.IsDigit(before) && char.IsDigit(after),
            _ => false,
        };
    }
}
