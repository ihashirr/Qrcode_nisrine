import fs from "node:fs";
import { PRODUCTS_JSON } from "../lib/paths";

/**
 * The master data source. `products.json` at the repo root is the single
 * source of truth — it holds ONLY custom internal barcode strings and their
 * category, never database IDs. Edit that file to change what gets generated.
 */
export interface Product {
  /** Custom Code128 payload printed on the label, e.g. "INT-M1001". */
  internalBarcode: string;
  /** Display category, e.g. "Mix Sweet" or "Pastries". */
  category: string;
}

export interface Company {
  name: string;
  shortCode: string;
}

interface ProductsFile {
  company: Company;
  products: Product[];
}

function load(): ProductsFile {
  const raw = fs.readFileSync(PRODUCTS_JSON, "utf8");
  return JSON.parse(raw) as ProductsFile;
}

export function getCompany(): Company {
  return load().company;
}

export function getProducts(): Product[] {
  return load().products;
}

/** URL-safe slug for a category name, e.g. "Mix Sweet" -> "mix-sweet". */
export function categorySlug(category: string): string {
  return category.toLowerCase().replace(/\s+/g, "-");
}

/** Products whose category slug matches the given slug. */
export function productsByCategorySlug(slug: string): Product[] {
  return getProducts().filter((p) => categorySlug(p.category) === slug);
}

/** Distinct categories with their unit counts, in first-seen order. */
export function getCategories(): { name: string; slug: string; count: number }[] {
  const order: string[] = [];
  const counts = new Map<string, number>();
  for (const p of getProducts()) {
    if (!counts.has(p.category)) order.push(p.category);
    counts.set(p.category, (counts.get(p.category) ?? 0) + 1);
  }
  return order.map((name) => ({
    name,
    slug: categorySlug(name),
    count: counts.get(name) ?? 0,
  }));
}
