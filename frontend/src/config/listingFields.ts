import type { ProductSpecification } from "../types";

// Category-specific listing fields, shown on the second Sell step. Each
// category declares its fields here; the Sell screen renders, validates and
// saves whatever the selected category (and subtype) declares, so adding a
// field or category needs no screen changes.

export type FieldType = "text" | "number" | "select";

/** Common listing fields (first Sell step) that a category field can stand in for. */
export type CommonField = "brand" | "model";

export interface ListingField {
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  /** Choices for "select" fields, shown as chips. */
  options?: readonly string[];
  placeholder?: string;
  /** Appended to number values, e.g. "%" or "cm". */
  unit?: string;
  min?: number;
  max?: number;
  /** Minimum length for text values. */
  minLength?: number;
  multiline?: boolean;
  /** Edits the common field of this name instead of being saved as a specification. */
  common?: CommonField;
  /** Hidden when the category's subtype is one of these (a subtype field replaces it). */
  hiddenFor?: readonly string[];
  /** Extra check for a filled-in value; returns a message when invalid. */
  validate?: (value: string) => string | undefined;
}

export interface CategoryFields {
  fields: readonly ListingField[];
  /** Key of the select field whose value chooses the subtype, e.g. "furnitureType". */
  subtypeKey?: string;
  /** Extra fields per subtype, shown right after the subtype field. */
  subtypes?: Readonly<Record<string, readonly ListingField[]>>;
}

export type FieldValues = Record<string, string>;

/** Brand and model, shared with the common fields on the first Sell step. */
const brand: ListingField = { key: "brand", label: "Brand", type: "text", required: true, minLength: 2, common: "brand" };
const model: ListingField = { key: "model", label: "Model", type: "text", required: true, common: "model" };

export const CATEGORY_FIELDS: Readonly<Record<string, CategoryFields>> = {
};

export function hasCategoryFields(category: string) {
  return category in CATEGORY_FIELDS;
}

/** The fields to show for a category, including those of the chosen subtype, in display order. */
export function fieldsFor(category: string, values: FieldValues): ListingField[] {
  const config = CATEGORY_FIELDS[category];
  if (!config) return [];
  const subtype = config.subtypeKey ? (values[config.subtypeKey] ?? "").trim() : "";
  const fields = config.fields.filter((field) => !subtype || !field.hiddenFor?.includes(subtype));
  const extra = (subtype && config.subtypes?.[subtype]) || [];
  const after = config.subtypeKey ? fields.findIndex((field) => field.key === config.subtypeKey) + 1 : fields.length;
  return [...fields.slice(0, after), ...extra, ...fields.slice(after)];
}

/** "RAM" stays "RAM"; "Storage capacity" becomes "storage capacity" inside a sentence. */
function inSentence(label: string) {
  return label.length > 1 && label[1] === label[1]!.toUpperCase() ? label : label[0]!.toLowerCase() + label.slice(1);
}

/** A validation message for one field, or undefined when the value is acceptable. */
export function validateField(field: ListingField, raw: string): string | undefined {
  const value = raw.trim();
  if (!value) return field.required ? (field.type === "select" ? `Choose the ${inSentence(field.label)}.` : `Add the ${inSentence(field.label)}.`) : undefined;

  if (field.type === "number") {
    const number = Number(value);
    const unit = field.unit === "%" ? "%" : field.unit ? ` ${field.unit}` : "";
    if (!Number.isFinite(number)) return `Enter a number for the ${inSentence(field.label)}.`;
    if (field.min !== undefined && number < field.min) return `${field.label} must be at least ${field.min}${unit}.`;
    if (field.max !== undefined && number > field.max) return `${field.label} must be at most ${field.max}${unit}.`;
  }
  if (field.type === "select" && field.options && !field.options.includes(value)) return `Choose one of the ${inSentence(field.label)} options.`;
  if (field.minLength && value.length < field.minLength) return `${field.label} must be at least ${field.minLength} characters.`;
  if (value.length > 200) return `Keep the ${inSentence(field.label)} under 200 characters.`;
  return field.validate?.(value);
}

/** Messages for every invalid field the category currently shows, keyed by field key. */
export function validateCategoryFields(category: string, values: FieldValues): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const field of fieldsFor(category, values)) {
    const message = validateField(field, values[field.key] ?? "");
    if (message) errors[field.key] = message;
  }
  return errors;
}

/** A field's value as buyers see it, e.g. "88%" or "120 cm". */
export function formatFieldValue(field: ListingField, raw: string) {
  const value = raw.trim();
  if (field.type !== "number" || !field.unit) return value;
  return field.unit === "%" ? `${value}%` : `${value} ${field.unit}`;
}

/** The filled-in category fields (excluding brand and model) as specifications to save. */
export function toSpecifications(category: string, values: FieldValues): ProductSpecification[] {
  return fieldsFor(category, values)
    .filter((field) => !field.common && (values[field.key] ?? "").trim() !== "")
    .map((field) => ({ key: field.key, label: field.label, value: formatFieldValue(field, values[field.key]!) }));
}
