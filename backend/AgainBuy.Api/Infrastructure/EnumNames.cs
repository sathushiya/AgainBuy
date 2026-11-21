using System.Reflection;
using System.Text.Json.Serialization;

namespace AgainBuy.Api.Infrastructure;

// Query-string binding uses Enum.TryParse, which knows nothing about the JSON
// names ("Like new", "Meetup scheduled"). This accepts either form.
public static class EnumNames
{
    public static bool TryParse<TEnum>(string? value, out TEnum result) where TEnum : struct, Enum
    {
        result = default;
        if (string.IsNullOrWhiteSpace(value)) return false;

        foreach (var field in typeof(TEnum).GetFields(BindingFlags.Public | BindingFlags.Static))
        {
            var jsonName = field.GetCustomAttribute<JsonStringEnumMemberNameAttribute>()?.Name;
            if (string.Equals(jsonName, value, StringComparison.OrdinalIgnoreCase))
            {
                result = (TEnum)field.GetValue(null)!;
                return true;
            }
        }

        return Enum.TryParse(value, ignoreCase: true, out result) && Enum.IsDefined(result);
    }
}
