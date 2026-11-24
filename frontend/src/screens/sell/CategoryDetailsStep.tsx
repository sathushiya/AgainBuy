import { StyleSheet, Text, View } from "react-native";
import { AppTextInput, BackButton, FilterChip, PrimaryButton, ScreenContainer } from "../../components/core";
import { fieldsFor, type FieldValues, type ListingField } from "../../config/listingFields";
import { colors, radius, spacing, typography } from "../../theme";

/**
 * Second Sell step: the fields declared for the selected category (and its
 * subtype) in config/listingFields.ts. Rendering is driven entirely by that
 * configuration, so every category uses this same component.
 */
export function CategoryDetailsStep({ category, values, errors, showErrors, onChange, onBack, onNext }: {
  category: string;
  /** Category values, plus brand and model from the first step. */
  values: FieldValues;
  errors: Record<string, string>;
  /** Errors appear once the seller has tried to continue. */
  showErrors: boolean;
  onChange: (key: string, value: string) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const fields = fieldsFor(category, values);
  const blocking = showErrors && Object.keys(errors).length > 0;

  return <ScreenContainer keyboardAware><BackButton label="Back to listing details" onPress={onBack}/><Text style={styles.eyebrow}>STEP 2 OF 3 · {category.toUpperCase()} DETAILS</Text><Text style={styles.title}>Tell buyers the specifics.</Text><Text style={styles.subtitle}>{fields.length ? "These details are specific to " + category.toLowerCase() + ". Fields marked optional can be left blank." : `No extra details are needed for ${category.toLowerCase()}. Continue to review your listing.`}</Text><View style={styles.form}>{fields.map((field) => <Field key={field.key} field={field} value={values[field.key] ?? ""} error={showErrors ? errors[field.key] : undefined} onChange={(value) => onChange(field.key, value)}/>)}{blocking && <Text style={styles.summary}>Complete the highlighted fields to continue.</Text>}<PrimaryButton title="Next" onPress={onNext}/></View></ScreenContainer>;
}

function Field({ field, value, error, onChange }: { field: ListingField; value: string; error?: string; onChange: (value: string) => void }) {
  const label = `${field.label}${field.type === "number" && field.unit ? ` (${field.unit})` : ""}${field.required ? "" : " (optional)"}`;

  if (field.type === "select") {
    return <View><Text style={styles.label}>{label}</Text><View style={styles.chips}>{(field.options ?? []).map((option) => <FilterChip key={option} label={option} selected={value === option} onPress={() => onChange(value === option && !field.required ? "" : option)}/>)}</View>{error && <Text style={styles.error}>{error}</Text>}</View>;
  }
  return <AppTextInput label={label} value={value} onChangeText={onChange} placeholder={field.placeholder} keyboardType={field.type === "number" ? "decimal-pad" : "default"} multiline={field.multiline} error={error}/>;
}

const styles = StyleSheet.create({
  eyebrow: { ...typography.label, color: colors.green, letterSpacing: 1 },
  title: { ...typography.display, color: colors.charcoal, marginTop: spacing.xs },
  subtitle: { ...typography.body, color: colors.textSecondary, marginTop: spacing.xs },
  form: { gap: spacing.md, marginTop: spacing.lg },
  label: { ...typography.caption, color: colors.charcoal, fontWeight: "700" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs, marginTop: spacing.xs },
  error: { ...typography.caption, color: colors.error, marginTop: spacing.xs },
  summary: { ...typography.caption, color: colors.error, fontWeight: "700", backgroundColor: colors.creamSecondary, borderRadius: radius.md, padding: spacing.sm },
});
