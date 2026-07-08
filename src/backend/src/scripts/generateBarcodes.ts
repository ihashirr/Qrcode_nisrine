import fs from "node:fs/promises";
import path from "node:path";
import { CATEGORIES, COMPANY } from "../config/categories";
import { buildLabelImage } from "../lib/composite";
import { OUTPUT_DIR } from "../lib/paths";

function slugify(name: string): string {
  return name.toLowerCase().replace(/\s+/g, "-");
}

function barcodeValue(code: string, sequence: number): string {
  return `${COMPANY.shortCode}-${code}-${String(sequence).padStart(2, "0")}`;
}

/**
 * Generates one composite label PNG per unit across every configured
 * category (currently 9 "Mix Sweet" + 4 "Pastries" = 13 total) and writes
 * them to /assets/output. Re-running overwrites existing files, so it's
 * safe to call after editing categories.ts or swapping the master assets.
 */
export async function generateAll(): Promise<string[]> {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  const written: string[] = [];

  for (const category of CATEGORIES) {
    for (let sequence = 1; sequence <= category.count; sequence += 1) {
      const value = barcodeValue(category.code, sequence);
      const image = await buildLabelImage({ categoryName: category.name, barcodeValue: value });

      const filename = `${slugify(category.name)}-${String(sequence).padStart(2, "0")}.png`;
      const filePath = path.join(OUTPUT_DIR, filename);
      await fs.writeFile(filePath, image);
      written.push(filePath);
      console.log(`generated ${filename} (${value})`);
    }
  }

  return written;
}

if (require.main === module) {
  generateAll()
    .then((files) => console.log(`\nDone: ${files.length} barcode assets written to ${OUTPUT_DIR}`))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
