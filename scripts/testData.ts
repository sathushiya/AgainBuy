import { categories, products, transactions } from "../src/data/mockData";

if (products.length < 8) throw new Error("Expected at least eight products");
if (!categories.includes("Phones") || !categories.includes("Furniture")) throw new Error("Missing marketplace categories");
if (!products.every((product) => product.price > 0 && product.location && product.defects)) throw new Error("Incomplete product data");
if (!transactions.some((item) => item.type === "purchase") || !transactions.some((item) => item.type === "sale")) throw new Error("Missing unified-account transaction types");
console.log(`PASS ${products.length} products, ${categories.length} categories, unified purchases and sales`);
