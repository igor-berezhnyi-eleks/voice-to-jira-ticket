namespace VoiceToTicket.Evaluation;

public sealed class WerTests
{
    [Fact]
    public void Identical_text_has_no_errors()
    {
        var result = Wer.Compute("the export button is broken", "the export button is broken");

        Assert.Equal(new WerResult(5, 0, 0, 0), result);
        Assert.Equal(0.0, result.Rate);
    }

    [Theory]
    [InlineData("the export button is broken", "the export button was broken", 1, 0, 0)]
    [InlineData("the export button is broken", "the export button broken", 0, 1, 0)]
    [InlineData("the export button is broken", "the export button is very broken", 0, 0, 1)]
    public void One_error_of_each_kind_is_counted_once(string reference, string hypothesis, int substitutions, int deletions, int insertions)
    {
        var result = Wer.Compute(reference, hypothesis);

        Assert.Equal(substitutions, result.Substitutions);
        Assert.Equal(deletions, result.Deletions);
        Assert.Equal(insertions, result.Insertions);
        Assert.Equal(1.0 / result.ReferenceWords, result.Rate);
    }

    [Fact]
    public void Case_and_punctuation_do_not_count()
    {
        var result = Wer.Compute("It's broken, isn't it? Yes - really.", "its broken isnt it yes really");

        // "it's" and "its" are different words; the rest matches once punctuation is gone.
        Assert.Equal(2, result.Substitutions);
        Assert.Equal(0, result.Deletions);
        Assert.Equal(0, result.Insertions);
        Assert.Equal(6, result.ReferenceWords);
    }

    [Fact]
    public void Apostrophes_inside_words_are_kept_and_curly_ones_are_the_same()
    {
        Assert.Equal(["it's", "broken"], Wer.Words("It’s broken."));
    }

    [Fact]
    public void A_version_number_is_one_word()
    {
        Assert.Equal(["version", "3.8", "fails"], Wer.Words("Version 3.8 fails."));
        Assert.Equal(new WerResult(3, 0, 0, 0), Wer.Compute("Version 3.8 fails.", "version 3.8 fails"));
    }

    [Fact]
    public void A_sentence_ending_dot_is_not_part_of_a_word()
    {
        Assert.Equal(["fails", "again"], Wer.Words("fails. again"));
        Assert.Equal(["page", "3"], Wer.Words("page 3."));
    }

    [Fact]
    public void Number_words_are_not_converted()
    {
        var result = Wer.Compute("three items", "3 items");

        Assert.Equal(1, result.Substitutions);
        Assert.Equal(0.5, result.Rate);
    }

    [Fact]
    public void An_empty_hypothesis_is_all_deletions()
    {
        var result = Wer.Compute("one two three", "");

        Assert.Equal(new WerResult(3, 0, 3, 0), result);
        Assert.Equal(1.0, result.Rate);
    }

    [Fact]
    public void A_dot_only_hypothesis_counts_as_empty()
    {
        Assert.Equal(1.0, Wer.Compute("one two", ".").Rate);
    }

    [Fact]
    public void An_empty_reference_has_no_rate()
    {
        var result = Wer.Compute("", "something");

        Assert.Equal(0, result.ReferenceWords);
        Assert.Equal(1, result.Insertions);
        Assert.Null(result.Rate);
    }

    [Fact]
    public void The_rate_can_exceed_one()
    {
        // One substitution and three insertions over one reference word.
        Assert.Equal(4.0, Wer.Compute("one", "a b c d").Rate);
    }

    [Fact]
    public void The_pooled_rate_weights_by_words_not_by_scenario()
    {
        var short1 = new WerResult(2, 1, 0, 0); // 50 %
        var long1 = new WerResult(8, 0, 0, 0); // 0 %

        Assert.Equal(0.1, Wer.Pooled([short1, long1]));
        Assert.Null(Wer.Pooled([]));
        Assert.Null(Wer.Pooled([new WerResult(0, 0, 0, 1)]));
    }
}
