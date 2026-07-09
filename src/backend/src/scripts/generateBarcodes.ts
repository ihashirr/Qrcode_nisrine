import fs from "node:fs/promises";
import path from "node:path";
import { categorySlug, getProducts, productsByCategorySlug, type Product } from "../config/products";
import { buildLabelImage } from "../lib/composite";
import { OUTPUT_DIR, USED_BARCODES_LOG } from "../lib/paths";

function fileNameFor(product: Product): string {
  // Filenames trace back to the internal SKU, e.g. int-m1001.png — SKUs are
  // unique per sticker even when a category shares one GTIN.
  return `${product.sku.toLowerCase()}.png`;
}

/** Appends this run's assignments to the internal registry (used_barcodes.log)
 * so there is a permanent text record of which GTIN each product claimed. */
async function appendLog(products: Product[]): Promise<void> {
  const stamp = new Date().toISOString();
  const lines = products
    .map((p) => `${stamp} | ${p.sku} | ${p.category} | GTIN ${p.gtin} | ${fileNameFor(p)}`)
    .join("\n");
  await fs.appendFile(USED_BARCODES_LOG, `${lines}\n`, "utf8");
}

async function generateProducts(products: Product[]): Promise<string[]> {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  const written: string[] = [];

  for (const product of products) {
    const image = await buildLabelImage({
      categoryName: product.category,
      barcodeValue: product.gtin,
      ingredients: product.ingredients,
      ingredientsAr: product.ingredientsAr,
    });
    const filePath = path.join(OUTPUT_DIR, fileNameFor(product));
    await fs.writeFile(filePath, image);
    written.push(filePath);
    console.log(`generated ${path.basename(filePath)} (${product.category} · GTIN ${product.gtin})`);
  }

  if (written.length > 0) await appendLog(products);
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
      console.error(err instanceof Error ? err.message : err);
      process.exit(1);
    });
}
