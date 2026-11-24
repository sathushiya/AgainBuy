using System.Text.RegularExpressions;

namespace AgainBuy.Api.Assistant;

/// <summary>
/// Follow-up questions. The model writes them after its answer, below a
/// "FOLLOW-UPS:" line, in the same call (no extra tokens). This splits them off
/// and always returns exactly four, filling gaps with sensible defaults.
/// </summary>
public static partial class FollowUps
{
    public const int Count = 4;
    public const int MaxLength = 100;

    public const string Instruction = """
        FOLLOW-UP QUESTIONS: End every reply with a line "FOLLOW-UPS:" and then exactly 4 short questions the user is likely to ask next, one per line. Write them as the user would ask them (e.g. "Does the MacBook have any scratches?"), under 70 characters, specific to what you just discussed (name the listing or step), different from each other and from questions already asked, and answerable by you. Nothing after them.
        """;

    private static readonly string[] General = ["What phones are for sale?", "Anything under LKR 15,000?", "How does reserving an item work?", "How do I pay safely?", "How do I sell an item?", "What can't I sell on AgainBuy?"];
    private static readonly string[] AboutListing = ["Does it have any defects?", "What comes with it?", "Is delivery available?", "How do I reserve it?", "How do I pay the seller?", "Can I ask the seller for more photos?"];

    [GeneratedRegex(@"^\s*(?:\*\*|__)?\s*follow[\s-]*ups?\s*(?:questions?)?\s*:?\s*(?:\*\*|__)?\s*:?\s*$", RegexOptions.IgnoreCase | RegexOptions.Multiline)]
    private static partial Regex Marker();

    [GeneratedRegex(@"^\s*(?:[-*•]+|\d+[.)])\s*")]
    private static partial Regex ListPrefix();

    /// <summary>Splits a reply into the answer and four follow-ups. Excludes questions already asked in this chat.</summary>
    public static (string Answer, IReadOnlyList<string> Suggestions) Split(string reply, bool aboutListing, IEnumerable<string> alreadyAsked)
    {
        var asked = new HashSet<string>(alreadyAsked.Select(Normalise), StringComparer.Ordinal);
        var answer = reply.Trim();
        var suggested = new List<string>();

        var marker = Marker().Matches(reply).LastOrDefault();
        if (marker is not null)
        {
            answer = reply[..marker.Index].Trim();
            foreach (var raw in reply[(marker.Index + marker.Length)..].Split('\n'))
            {
                var line = ListPrefix().Replace(raw, "").Trim().Trim('"', '“', '”', '*', '_').Trim();
                if (line.Length < 4 || line.Length > MaxLength) continue;
                if (asked.Contains(Normalise(line)) || suggested.Any(existing => Normalise(existing) == Normalise(line))) continue;
                suggested.Add(line);
                if (suggested.Count == Count) break;
            }
        }

        foreach (var fallback in aboutListing ? AboutListing : General)
        {
            if (suggested.Count == Count) break;
            if (asked.Contains(Normalise(fallback)) || suggested.Any(existing => Normalise(existing) == Normalise(fallback))) continue;
            suggested.Add(fallback);
        }
        return (answer, suggested);
    }

    private static string Normalise(string question) => new string(question.Where(char.IsLetterOrDigit).ToArray()).ToLowerInvariant();
}
