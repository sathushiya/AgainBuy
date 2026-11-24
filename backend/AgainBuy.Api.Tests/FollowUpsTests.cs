using AgainBuy.Api.Assistant;

namespace AgainBuy.Api.Tests;

public class FollowUpsTests
{
    [Theory]
    [InlineData("FOLLOW-UPS:")]
    [InlineData("Follow-ups:")]
    [InlineData("**Follow-up questions:**")]
    [InlineData("follow ups")]
    public void Splits_the_answer_from_the_follow_ups_in_any_common_format(string marker)
    {
        var reply = $"The MacBook Air M1 costs LKR 185,000.\n\n{marker}\n- Does it have scratches?\n• \"What charger comes with it?\"\n3) Can it be delivered?\n4. How do I reserve it?";

        var (answer, suggestions) = FollowUps.Split(reply, aboutListing: false, []);

        Assert.Equal("The MacBook Air M1 costs LKR 185,000.", answer);
        Assert.Equal(["Does it have scratches?", "What charger comes with it?", "Can it be delivered?", "How do I reserve it?"], suggestions);
    }

    [Fact]
    public void Always_returns_four_distinct_questions_not_already_asked()
    {
        var reply = "Answer.\nFOLLOW-UPS:\nHow do I pay safely?\nhow do i pay safely\nWhat phones are for sale?\n" + new string('x', 150) + "?";

        var (_, suggestions) = FollowUps.Split(reply, aboutListing: false, ["What phones are for sale?"]);

        Assert.Equal(FollowUps.Count, suggestions.Count);
        Assert.Equal("How do I pay safely?", suggestions[0]);
        Assert.Equal(suggestions.Count, suggestions.Distinct(StringComparer.OrdinalIgnoreCase).Count());
        Assert.DoesNotContain("What phones are for sale?", suggestions);
        Assert.All(suggestions, suggestion => Assert.InRange(suggestion.Length, 4, FollowUps.MaxLength));
    }

    [Fact]
    public void Without_follow_ups_the_whole_reply_is_the_answer_and_defaults_fill_in()
    {
        var (answer, suggestions) = FollowUps.Split("  Tap Reserve to hold it.  ", aboutListing: true, []);

        Assert.Equal("Tap Reserve to hold it.", answer);
        Assert.Equal(["Does it have any defects?", "What comes with it?", "Is delivery available?", "How do I reserve it?"], suggestions);
    }

    [Fact]
    public void Uses_the_last_marker_so_earlier_mentions_stay_in_the_answer()
    {
        var reply = "Follow-ups:\nare not part of this.\nReal answer.\nFOLLOW-UPS:\nWhat next?";

        var (answer, suggestions) = FollowUps.Split(reply, aboutListing: false, []);

        Assert.StartsWith("Follow-ups:", answer);
        Assert.EndsWith("Real answer.", answer);
        Assert.Equal("What next?", suggestions[0]);
    }
}
