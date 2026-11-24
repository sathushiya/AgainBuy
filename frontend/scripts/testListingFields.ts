import { CATEGORY_FIELDS, fieldsFor, toSpecifications, validateCategoryFields, type FieldValues } from "../src/config/listingFields";

let failures = 0;
function check(condition: boolean, message: string) {
  if (condition) console.log(`PASS ${message}`);
  else { failures++; console.error(`FAIL ${message}`); }
}
const keys = (category: string, values: FieldValues = {}) => fieldsFor(category, values).map((field) => field.key);
const errorKeys = (category: string, values: FieldValues) => Object.keys(validateCategoryFields(category, values)).sort();

// Every marketplace category is configured, consistently.
const seeded = ["Phones", "Laptops", "Furniture", "Electronics", "Books", "Clothing", "Sports", "Appliances"];
check(seeded.every((category) => category in CATEGORY_FIELDS), "all eight categories have fields");
for (const [category, config] of Object.entries(CATEGORY_FIELDS)) {
  const variants = [undefined, ...Object.keys(config.subtypes ?? {})];
  for (const subtype of variants) {
    const values = config.subtypeKey && subtype ? { [config.subtypeKey]: subtype } : {};
    const shown = fieldsFor(category, values);
    check(new Set(shown.map((field) => field.key)).size === shown.length, `${category}${subtype ? ` / ${subtype}` : ""}: field keys are unique`);
    check(shown.every((field) => field.type !== "select" || (field.options?.length ?? 0) > 1), `${category}${subtype ? ` / ${subtype}` : ""}: every choice field has options`);
  }
  if (config.subtypeKey) check(config.fields.some((field) => field.key === config.subtypeKey && field.type === "select"), `${category}: subtype is chosen with a select field`);
}

// Only the selected category's fields are shown.
check(keys("Phones").join() === "brand,model,storage,ram,phoneType,batteryHealth", "Phones shows only phone fields");
check(!keys("Phones").includes("furnitureType") && !keys("Laptops").includes("phoneType"), "categories don't leak fields into each other");
check(keys("Toys").length === 0, "a category without a definition shows no extra fields");

// Subtypes add (and sometimes replace) fields.
check(keys("Furniture", { furnitureType: "Sofa" }).includes("seats") && !keys("Furniture", { furnitureType: "Bed" }).includes("seats"), "Sofa adds seats, Bed doesn't");
check(keys("Furniture", { furnitureType: "Bed" }).includes("bedSize"), "Bed adds bed size");
check(["screenSize", "resolution", "refreshRate"].every((key) => keys("Electronics", { electronicsType: "Monitor" }).includes(key)), "Monitor adds screen size, resolution and refresh rate");
check(!keys("Electronics", { electronicsType: "Headphones" }).includes("refreshRate"), "Headphones don't get monitor fields");
check(["frameSize", "gears", "bicycleType"].every((key) => keys("Sports", { equipmentType: "Bicycle" }).includes(key)), "Bicycle adds frame size, gears and type");
const fridge = keys("Appliances", { applianceType: "Refrigerator" });
check(fridge.includes("fridgeCapacity") && fridge.includes("refrigeratorType") && !fridge.includes("capacity"), "Refrigerator swaps general capacity for litres and type");
check(keys("Appliances", { applianceType: "Washing machine" }).includes("washingMachineType"), "Washing machine adds its type");
const shoes = keys("Clothing", { clothingType: "Shoes" });
check(shoes.includes("shoeSize") && !shoes.includes("size"), "Shoes swap clothing size for shoe size");
check(keys("Furniture", { furnitureType: "Sofa" }).indexOf("seats") === keys("Furniture", { furnitureType: "Sofa" }).indexOf("furnitureType") + 1, "subtype fields appear right after the subtype choice");

// Validation is category-specific.
check(errorKeys("Phones", {}).join() === "brand,model,phoneType,storage", "Phones requires brand, model, storage and phone type only");
check(errorKeys("Books", {}).join() === "author,bookCategory,bookTitle,language", "Books requires title, author, category and language");
check(errorKeys("Furniture", { furnitureType: "Sofa" }).includes("seats"), "a Sofa needs its seat count");
const phone: FieldValues = { brand: "Apple", model: "iPhone 13", storage: "128 GB", phoneType: "Smartphone" };
check(errorKeys("Phones", phone).length === 0, "a complete phone passes");
check(errorKeys("Phones", { ...phone, batteryHealth: "150" }).join() === "batteryHealth", "battery health over 100% is rejected");
check(errorKeys("Phones", { ...phone, storage: "3 TB" }).join() === "storage", "an unknown choice is rejected");
const book: FieldValues = { bookTitle: "Clean Code", author: "Robert C. Martin", bookCategory: "Non-fiction", language: "English" };
check(errorKeys("Books", { ...book, isbn: "978-0132350884" }).length === 0, "a valid ISBN-13 passes");
check(errorKeys("Books", { ...book, isbn: "12345" }).join() === "isbn", "a malformed ISBN is rejected");
check(validateCategoryFields("Phones", {}).storage === "Choose the storage capacity.", "select messages read naturally");
check(validateCategoryFields("Phones", {}).brand === "Add the brand.", "text messages read naturally");

// Saved specifications leave out brand/model and include units.
const specifications = toSpecifications("Phones", { ...phone, batteryHealth: "88", ram: "" });
check(specifications.map((specification) => specification.key).join() === "storage,phoneType,batteryHealth", "specifications skip brand, model and blanks");
check(specifications.at(-1)?.value === "88%", "number values carry their unit");
check(toSpecifications("Furniture", { furnitureType: "Sofa", length: "200", seats: "3" }).some((specification) => specification.value === "200 cm"), "dimensions are saved in cm");

if (failures) {
  console.error(`${failures} check(s) failed`);
  process.exit(1);
}
console.log("All listing field checks passed");
