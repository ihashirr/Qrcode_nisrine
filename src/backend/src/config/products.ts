import fs from "node:fs";
import { PRODUCTS_JSON } from "../lib/paths";

/**
 * The master data source. `products.json` at the repo root is the single
 * source of truth — it holds ONLY custom internal barcode strings and their
 * category, never database IDs. Edit that file to change what gets generated.
 */
export interface Product {
  /** Barcode payload printed on the sticker, e.g. "INT-M1001" (Code128) or a 12/13-digit GTIN (EAN). */
  internalBarcode: string;
  /** Display category, e.g. "Mix Sweet" or "Pastries". */
  category: string;
  /** Optional per-product ingredients override (falls back to defaults.ingredients). */
  ingredients?: string;
  /** Optional per-product Arabic ingredients override. */
  ingredientsAr?: string;
}

export interface Company {
  name: string;
  shortCode: string;
  /** Secondary brand line printed under the logo, e.g. "Sweets & Bakery". */
  tagline: string;
  contact: {
    mobiles: string[];
    location: string;
  };
}

interface ProductsFile {
  company: Company;
  defaults?: { ingredients?: string; ingredientsAr?: string };
  products: Product[];
}

function load(): ProductsFile {
  const raw = fs.readFileSync(PRODUCTS_JSON, "utf8");
  const data = JSON.parse(raw) as ProductsFile;

  // Fail loudly on bad data — a duplicate or blank barcode would silently
  // overwrite another product's label file or emit an unscannable symbol.
  const seen = new Set<string>();
  for (const p of data.products ?? []) {
    if (!p.internalBarcode?.trim() || !p.category?.trim()) {
      throw new Error(`products.json: every product needs a non-empty internalBarcode and category (got ${JSON.stringify(p)})`);
    }
    if (seen.has(p.internalBarcode)) {
      throw new Error(`products.json: duplicate internalBarcode "${p.internalBarcode}"`);
    }
    seen.add(p.internalBarcode);
  }
  return data;
}

export function getCompany(): Company {
  return load().company;
}

export function getProducts(): Product[] {
  const data = load();
  // Resolve per-product ingredient overrides against the file-level defaults
  // here, so downstream consumers never re-implement the fallback.
  return data.products.map((p) => ({
    ...p,
    ingredients: p.ingredients ?? data.defaults?.ingredients ?? "",
    ingredientsAr: p.ingredientsAr ?? data.defaults?.ingredientsAr ?? "",
  }));
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
