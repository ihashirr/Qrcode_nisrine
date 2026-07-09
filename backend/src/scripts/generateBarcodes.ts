import fs from "node:fs/promises";
import path from "node:path";
import {
  AuditError,
  categorySlug,
  getCompany,
  getProducts,
  productsByCategorySlug,
  type Product,
} from "../config/products";
import { buildLabelImage, MasterAssetError } from "../lib/composite";
import { OUTPUT_DIR, USED_BARCODES_LOG } from "../lib/paths";

function fileNameFor(product: Product): string {
  // Filenames trace back to the internal SKU, e.g. int-m1001.png — SKUs are
  // unique per sticker even when a category shares one GTIN.
  return `${product.sku.toLowerCase()}.png`;
}

async function generateProducts(products: Product[]): Promise<string[]> {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  const company = getCompany(); // one audited config load for the whole run
  const stamp = new Date().toISOString();
  const written: string[] = [];

  for (const product of products) {
    const image = await buildLabelImage({
      categoryName: product.category,
      barcodeValue: product.gtin,
      company,
      ingredients: product.ingredients,
      ingredientsAr: product.ingredientsAr,
    });
    const filePath = path.join(OUTPUT_DIR, fileNameFor(product));
    await fs.writeFile(filePath, image);
    // Register each claim immediately after its file lands, so the registry
    // never misses a sticker that exists on disk even if a later one fails.
    await fs.appendFile(
      USED_BARCODES_LOG,
      `${stamp} | ${product.sku} | ${product.category} | GTIN ${product.gtin} | ${fileNameFor(product)}\n`,
      "utf8"
    );
    written.push(filePath);
    console.log(`generated ${path.basename(filePath)} (${product.category} · GTIN ${product.gtin})`);
  }

  return written;
}

/** Generate every product in products.json. The pre-assignment audit runs on
 * config load — an invalid or conflicting GTIN aborts before any file is written. */
export async function generateAll(): Promise<string[]> {
  return generateProducts(getProducts());
}

/** Generate only the products in one category, addressed by its slug. */
export async function generateCategory(slug: string): Promise<string[]> {
  return generateProducts(productsByCategorySlug(slug));
}

if (require.main === module) {
  // Optional CLI arg: a category name or slug to generate just that group.
  const arg = process.argv[2];
  const run = arg ? () => generateCategory(categorySlug(arg)) : generateAll;

  run()
    .then((files) => {
      if (files.length === 0) {
        console.error(`No products matched${arg ? ` "${arg}"` : ""}. Check products.json.`);
        process.exit(1);
      }
      console.log(`\nDone: ${files.length} sticker assets written to ${OUTPUT_DIR}`);
      console.log(`Registry updated: ${USED_BARCODES_LOG}`);
    })
    .catch((err) => {
      // Expected, self-explanatory failures print as one line; anything else
      // keeps its stack trace for debugging.
      if (err instanceof AuditError || err instanceof MasterAssetError) {
        console.error(err.message);
      } else {
        console.error(err);
      }
      process.exit(1);
    });
}
