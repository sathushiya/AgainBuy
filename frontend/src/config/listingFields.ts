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
  Phones: {
    fields: [
      brand,
      model,
      { key: "storage", label: "Storage capacity", type: "select", required: true, options: ["16 GB", "32 GB", "64 GB", "128 GB", "256 GB", "512 GB", "1 TB"] },
      { key: "ram", label: "RAM", type: "select", options: ["2 GB", "3 GB", "4 GB", "6 GB", "8 GB", "12 GB", "16 GB"] },
      { key: "phoneType", label: "Phone type", type: "select", required: true, options: ["Smartphone", "Foldable", "Feature phone"] },
      { key: "batteryHealth", label: "Battery health", type: "number", unit: "%", min: 1, max: 100, placeholder: "e.g. 88" },
    ],
  },
  Laptops: {
    fields: [
      brand,
      model,
      { key: "processor", label: "Processor", type: "text", required: true, minLength: 2, placeholder: "e.g. Intel Core i5-1135G7 or Apple M1" },
      { key: "ram", label: "RAM", type: "select", required: true, options: ["4 GB", "8 GB", "16 GB", "32 GB", "64 GB"] },
      { key: "storageType", label: "Storage type", type: "select", required: true, options: ["SSD", "HDD", "SSD + HDD", "eMMC"] },
      { key: "storage", label: "Storage capacity", type: "select", required: true, options: ["128 GB", "256 GB", "512 GB", "1 TB", "2 TB"] },
      { key: "graphics", label: "Graphics card", type: "text", required: true, placeholder: "e.g. Integrated or NVIDIA RTX 3050" },
      { key: "screenSize", label: "Screen size", type: "select", required: true, options: ["11\"", "13\"", "14\"", "15.6\"", "16\"", "17\""] },
      { key: "os", label: "Operating system", type: "select", required: true, options: ["Windows", "macOS", "Linux", "ChromeOS", "None"] },
      { key: "batteryCondition", label: "Battery condition", type: "select", required: true, options: ["Excellent", "Good", "Fair", "Needs replacement"] },
    ],
  },
  Furniture: {
    subtypeKey: "furnitureType",
    fields: [
      { key: "furnitureType", label: "Furniture type", type: "select", required: true, options: ["Sofa", "Bed", "Table", "Chair", "Wardrobe", "Desk", "Shelf / Cabinet", "Other"] },
      brand,
      { key: "material", label: "Material", type: "select", required: true, options: ["Wood", "Metal", "Fabric", "Leather", "Rattan", "Plastic", "Glass", "Other"] },
      { key: "length", label: "Length", type: "number", required: true, unit: "cm", min: 1, max: 1000, placeholder: "cm" },
      { key: "width", label: "Width", type: "number", required: true, unit: "cm", min: 1, max: 1000, placeholder: "cm" },
      { key: "height", label: "Height", type: "number", required: true, unit: "cm", min: 1, max: 1000, placeholder: "cm" },
      { key: "colour", label: "Colour", type: "text", required: true, minLength: 2, placeholder: "e.g. Natural teak" },
    ],
    subtypes: {
      Sofa: [{ key: "seats", label: "Seats", type: "number", required: true, min: 1, max: 12, placeholder: "e.g. 3" }],
      Bed: [{ key: "bedSize", label: "Bed size", type: "select", required: true, options: ["Single", "Double", "Queen", "King"] }],
      Table: [{ key: "tableSeats", label: "Seating capacity", type: "number", min: 1, max: 20, placeholder: "e.g. 6" }],
      Wardrobe: [{ key: "doors", label: "Doors", type: "number", min: 1, max: 10, placeholder: "e.g. 3" }],
    },
  },
  Electronics: {
    subtypeKey: "electronicsType",
    fields: [
      { key: "electronicsType", label: "Electronics type", type: "select", required: true, options: ["Monitor", "Television", "Camera", "Headphones", "Speaker", "Tablet", "Smartwatch", "Gaming console", "Other"] },
      brand,
      model,
      { key: "specifications", label: "Other technical specifications", type: "text", multiline: true, placeholder: "Anything else a buyer should know, e.g. sensor size, ports" },
      { key: "powerConnectivity", label: "Power / connectivity", type: "text", placeholder: "e.g. Bluetooth 5.0, USB-C charging" },
    ],
    subtypes: {
      Monitor: [
        { key: "screenSize", label: "Screen size", type: "number", required: true, unit: "inches", min: 10, max: 100, placeholder: "e.g. 27" },
        { key: "resolution", label: "Resolution", type: "select", required: true, options: ["HD (1366×768)", "Full HD (1920×1080)", "QHD (2560×1440)", "4K (3840×2160)"] },
        { key: "refreshRate", label: "Refresh rate", type: "select", required: true, options: ["60 Hz", "75 Hz", "100 Hz", "144 Hz", "165 Hz", "240 Hz"] },
      ],
      Television: [
        { key: "screenSize", label: "Screen size", type: "number", required: true, unit: "inches", min: 10, max: 120, placeholder: "e.g. 55" },
        { key: "resolution", label: "Resolution", type: "select", required: true, options: ["HD (1366×768)", "Full HD (1920×1080)", "4K (3840×2160)", "8K"] },
        { key: "smartTv", label: "Smart TV", type: "select", required: true, options: ["Yes", "No"] },
      ],
      Camera: [
        { key: "cameraType", label: "Camera type", type: "select", required: true, options: ["DSLR", "Mirrorless", "Compact", "Action camera", "Film camera"] },
        { key: "megapixels", label: "Megapixels", type: "number", unit: "MP", min: 1, max: 200, placeholder: "e.g. 24" },
        { key: "lens", label: "Lens included", type: "text", placeholder: "e.g. 18-55mm kit lens" },
      ],
      Headphones: [
        { key: "headphoneStyle", label: "Headphone style", type: "select", required: true, options: ["Over-ear", "On-ear", "In-ear"] },
        { key: "connection", label: "Connection", type: "select", required: true, options: ["Wireless", "Wired", "Both"] },
        { key: "noiseCancelling", label: "Noise cancelling", type: "select", options: ["Yes", "No"] },
      ],
      Speaker: [
        { key: "connection", label: "Connection", type: "select", required: true, options: ["Wireless", "Wired", "Both"] },
        { key: "powerOutput", label: "Power output", type: "number", unit: "W", min: 1, max: 5000, placeholder: "e.g. 20" },
      ],
      Tablet: [
        { key: "storage", label: "Storage capacity", type: "select", required: true, options: ["32 GB", "64 GB", "128 GB", "256 GB", "512 GB", "1 TB"] },
        { key: "screenSize", label: "Screen size", type: "number", unit: "inches", min: 6, max: 15, placeholder: "e.g. 10.9" },
        { key: "cellular", label: "Cellular (SIM)", type: "select", options: ["Yes", "No"] },
      ],
      Smartwatch: [{ key: "compatibility", label: "Works with", type: "select", required: true, options: ["Android", "iPhone", "Both"] }],
      "Gaming console": [
        { key: "storage", label: "Storage capacity", type: "select", options: ["500 GB", "825 GB", "1 TB", "2 TB"] },
        { key: "controllers", label: "Controllers included", type: "number", min: 0, max: 8, placeholder: "e.g. 2" },
      ],
    },
  },
  Books: {
    fields: [
      { key: "bookTitle", label: "Book title", type: "text", required: true, minLength: 2 },
      { key: "author", label: "Author", type: "text", required: true, minLength: 2 },
      { key: "bookCategory", label: "Book category", type: "select", required: true, options: ["Fiction", "Non-fiction", "Textbook / Academic", "Children's", "Comics", "Religious", "Other"] },
      { key: "language", label: "Language", type: "select", required: true, options: ["English", "Sinhala", "Tamil", "Other"] },
      { key: "edition", label: "Edition", type: "text", placeholder: "e.g. 3rd edition, 2019" },
      { key: "isbn", label: "ISBN", type: "text", placeholder: "10 or 13 digits, if printed on the book", validate: validateIsbn },
    ],
  },
  Clothing: {
    subtypeKey: "clothingType",
    fields: [
      { key: "clothingType", label: "Clothing type", type: "select", required: true, options: ["Shirt / Top", "T-shirt", "Trousers / Jeans", "Dress", "Skirt", "Jacket", "Saree", "Shoes", "Other"] },
      brand,
      { key: "size", label: "Size", type: "select", required: true, options: ["XS", "S", "M", "L", "XL", "XXL", "Free size"], hiddenFor: ["Shoes"] },
      { key: "colour", label: "Colour", type: "text", required: true, minLength: 2 },
      { key: "gender", label: "Gender / style", type: "select", required: true, options: ["Men", "Women", "Unisex", "Boys", "Girls"] },
      { key: "material", label: "Material", type: "text", required: true, minLength: 2, placeholder: "e.g. Cotton, denim, linen" },
    ],
    subtypes: {
      Shoes: [{ key: "shoeSize", label: "Shoe size (UK)", type: "number", required: true, min: 1, max: 15, placeholder: "e.g. 9" }],
    },
  },
};

/** Accepts ISBN-10 (last character may be X) or ISBN-13; spaces and hyphens are ignored. */
function validateIsbn(value: string) {
  const isbn = value.replace(/[\s-]/g, "").toUpperCase();
  return /^\d{9}[\dX]$/.test(isbn) || /^\d{13}$/.test(isbn) ? undefined : "Enter a 10 or 13 digit ISBN, or leave it blank.";
}

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
