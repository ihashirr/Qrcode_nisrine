import fs from "node:fs";
import { PRODUCTS_JSON } from "../lib/paths";

/**
 * The master data source and the ONLY authority on barcode numbers.
 * `products.json` at the repo root holds the company's assigned GTIN
 * allowlist (from the IBN Certificate of GTIN Assignment) and the
 * per-product assignments. Nothing outside that file may introduce a
 * barcode number.
 */
export interface Product {
  /** Internal SKU used for filenames and the log — never printed as a barcode. */
  sku: string;
  /** Display category, e.g. "Mix Sweet" or "Pastries". */
  category: string;
  /** The GTIN-13 printed on the sticker. Must pass the pre-assignment audit. */
  gtin: string;
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
  /** The GTINs the company owns, verbatim from the certificate. */
  assignedGtins: string[];
}

interface ProductsFile {
  company: Company;
  defaults?: { ingredients?: string; ingredientsAr?: string };
  products: Product[];
}

/** GTIN-13 check digit: weights 1,3,1,3… over the first 12 digits. */
export function isValidGtin13(gtin: string): boolean {
  if (!/^\d{13}$/.test(gtin)) return false;
  const digits = gtin.split("").map(Number);
  const sum = digits.slice(0, 12).reduce((acc, d, i) => acc + d * (i % 2 === 0 ? 1 : 3), 0);
  return (10 - (sum % 10)) % 10 === digits[12];
}

/**
 * Pre-assignment audit — runs before anything can generate. Throws (aborting
 * the run) when a barcode number is not a protected, conflict-free asset:
 *
 *  - "INT-" or any non-13-digit placeholder in the gtin field
 *  - a check digit that fails GTIN-13 math (a typo'd or fabricated number)
 *  - a number outside the certificate's assigned allowlist
 *  - the same GTIN assigned to two DIFFERENT categories (a real conflict;
 *    products within one category sharing their category's GTIN is correct
 *    retail practice — one GTIN identifies one product line)
 *  - duplicate SKUs (would silently overwrite another sticker file)
 */
function audit(data: ProductsFile): void {
  const abort = (detail: string): never => {
    throw new Error(`Conflict detected: Invalid or duplicate barcode number. ${detail}`);
  };

  const allow = new Set(data.company.assignedGtins ?? []);
  if (allow.size === 0) abort("company.assignedGtins is empty — paste the GTINs from the certificate.");
  for (const g of allow) {
    if (!isValidGtin13(g)) abort(`assigned GTIN "${g}" is not a valid GTIN-13.`);
  }

  const seenSkus = new Set<string>();
  const gtinCategory = new Map<string, string>();

  for (const p of data.products ?? []) {
    if (!p.sku?.trim() || !p.category?.trim()) {
      abort(`every product needs a non-empty sku and category (got ${JSON.stringify(p)}).`);
    }
    if (seenSkus.has(p.sku)) abort(`duplicate SKU "${p.sku}".`);
    seenSkus.add(p.sku);

    if (!p.gtin || p.gtin.toUpperCase().startsWith("INT-")) {
      abort(`product ${p.sku} still has a placeholder instead of an assigned GTIN.`);
    }
    if (!isValidGtin13(p.gtin)) {
      abort(`product ${p.sku} has GTIN "${p.gtin}" which fails GTIN-13 check-digit validation.`);
    }
    if (!allow.has(p.gtin)) {
      abort(`product ${p.sku} uses GTIN ${p.gtin} which is NOT in the assigned range on the certificate.`);
    }

    const owner = gtinCategory.get(p.gtin);
    if (owner && owner !== p.category) {
      abort(`GTIN ${p.gtin} is assigned to both "${owner}" and "${p.category}" — one GTIN must map to exactly one product line.`);
    }
    gtinCategory.set(p.gtin, p.category);
  }
}

function load(): ProductsFile {
  const raw = fs.readFileSync(PRODUCTS_JSON, "utf8");
  const data = JSON.parse(raw) as ProductsFile;
  audit(data);
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
