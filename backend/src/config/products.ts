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
  /** The GTIN printed on the sticker, canonicalized to 13 digits. */
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

/** Thrown by the pre-assignment audit — mapped to HTTP 409 by the API. */
export class AuditError extends Error {
  constructor(detail: string) {
    super(`Conflict detected: Invalid or duplicate barcode number. ${detail}`);
    this.name = "AuditError";
  }
}

/**
 * Canonicalizes a barcode payload to a 13-digit GTIN, or returns null if it
 * isn't one. A 12-digit UPC-A is the same number as its zero-padded GTIN-13
 * (the check digit is invariant under left zero-padding), so both lengths
 * are accepted and normalized to 13.
 */
export function canonicalGtin13(value: unknown): string | null {
  if (typeof value !== "string" || !/^\d{12,13}$/.test(value)) return null;
  const gtin = value.padStart(13, "0");
  const digits = gtin.split("").map(Number);
  const sum = digits.slice(0, 12).reduce((acc, d, i) => acc + d * (i % 2 === 0 ? 1 : 3), 0);
  return (10 - (sum % 10)) % 10 === digits[12] ? gtin : null;
}

/**
 * Pre-assignment audit — runs once per config load, before anything can
 * generate. Throws AuditError (aborting the run) when a barcode number is
 * not a protected, conflict-free asset:
 *
 *  - "INT-" or any other placeholder / non-GTIN value in the gtin field
 *  - a check digit that fails GTIN math (a typo'd or fabricated number)
 *  - a number outside the certificate's assigned allowlist
 *  - the same GTIN assigned to two DIFFERENT categories (a real conflict;
 *    products within one category sharing their category's GTIN is correct
 *    retail practice — one GTIN identifies one product line)
 *  - duplicate SKUs, compared case-insensitively because filenames are
 *    lowercased (a case-only difference would silently overwrite a file)
 *
 * Returns the file with every GTIN canonicalized to 13 digits.
 */
function audit(data: ProductsFile): ProductsFile {
  if (!data?.company || typeof data.company !== "object") {
    throw new AuditError('products.json is missing the "company" block.');
  }
  if (!Array.isArray(data.company.assignedGtins) || data.company.assignedGtins.length === 0) {
    throw new AuditError("company.assignedGtins is empty — paste the GTINs from the certificate.");
  }

  const allow = new Set<string>();
  for (const g of data.company.assignedGtins) {
    const canonical = canonicalGtin13(g);
    if (!canonical) throw new AuditError(`assigned GTIN "${g}" is not a valid GTIN-12/13.`);
    allow.add(canonical);
  }
  data.company.assignedGtins = [...allow];

  const seenSkus = new Set<string>();
  const gtinCategory = new Map<string, string>();

  for (const p of data.products ?? []) {
    if (typeof p.sku !== "string" || !p.sku.trim() || typeof p.category !== "string" || !p.category.trim()) {
      throw new AuditError(`every product needs a non-empty sku and category (got ${JSON.stringify(p)}).`);
    }
    const skuKey = p.sku.toLowerCase(); // filenames are lowercased — case-only SKUs collide
    if (seenSkus.has(skuKey)) throw new AuditError(`duplicate SKU "${p.sku}" (SKUs are case-insensitive).`);
    seenSkus.add(skuKey);

    const canonical = canonicalGtin13(p.gtin);
    if (!canonical) {
      throw new AuditError(
        `product ${p.sku} has gtin ${JSON.stringify(p.gtin)} which is not a valid GTIN-12/13 — still a placeholder?`
      );
    }
    if (!allow.has(canonical)) {
      throw new AuditError(`product ${p.sku} uses GTIN ${canonical} which is NOT in the assigned range on the certificate.`);
    }
    p.gtin = canonical;

    const owner = gtinCategory.get(canonical);
    if (owner && owner !== p.category) {
      throw new AuditError(
        `GTIN ${canonical} is assigned to both "${owner}" and "${p.category}" — one GTIN must map to exactly one product line.`
      );
    }
    gtinCategory.set(canonical, p.category);
  }

  return data;
}

// Cache the parsed + audited config, invalidated when products.json changes
// on disk. One generation run (or API request burst) then reads and audits
// the file once instead of once per accessor call.
let cache: { mtimeMs: number; data: ProductsFile } | null = null;

function load(): ProductsFile {
  const { mtimeMs } = fs.statSync(PRODUCTS_JSON);
  if (cache?.mtimeMs === mtimeMs) return cache.data;
  const data = audit(JSON.parse(fs.readFileSync(PRODUCTS_JSON, "utf8")) as ProductsFile);
  cache = { mtimeMs, data };
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
