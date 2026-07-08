/**
 * Single source of truth for barcode generation.
 * Add/remove a category here to change what the generator produces —
 * nothing else in the codebase should hardcode category names or counts.
 */
export interface CategoryConfig {
  /** Human-readable label printed on the asset and used in filenames. */
  name: string;
  /** Short code embedded in the barcode payload, e.g. SBPC-MSW-01. */
  code: string;
  /** How many sequential units to generate for this category. */
  count: number;
}

export const COMPANY = {
  name: "Sweets and Bakery Pistachio and Cashew L.L.C-O.P.C.",
  shortCode: "SBPC",
};

export const CATEGORIES: CategoryConfig[] = [
  { name: "Mix Sweet", code: "MSW", count: 9 },
  { name: "Pastries", code: "PST", count: 4 },
];

/** Total assets the current config produces (used by tests/sanity checks). */
export const TOTAL_ASSET_COUNT = CATEGORIES.reduce((sum, c) => sum + c.count, 0);
