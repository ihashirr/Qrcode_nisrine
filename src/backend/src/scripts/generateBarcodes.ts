import fs from "node:fs/promises";
import path from "node:path";
import { categorySlug, getProducts, productsByCategorySlug, type Product } from "../config/products";
import { buildLabelImage } from "../lib/composite";
import { OUTPUT_DIR } from "../lib/paths";

function fileNameFor(product: Product): string {
  // Filenames trace straight back to the internal barcode, e.g. int-m1001.png.
  return `${product.internalBarcode.toLowerCase()}.png`;
}

async function generateProducts(products: Product[]): Promise<string[]> {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  const written: string[] = [];

  for (const product of products) {
    const image = await buildLabelImage({
      categoryName: product.category,
      barcodeValue: product.internalBarcode,
    });
    const filePath = path.join(OUTPUT_DIR, fileNameFor(product));
    await fs.writeFile(filePath, image);
    written.push(filePath);
    console.log(`generated ${path.basename(filePath)} (${product.internalBarcode})`);
  }

  return written;
}

/** Generate every product in products.json (9 Mix Sweet + 4 Pastries = 13). */
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
      console.log(`\nDone: ${files.length} barcode assets written to ${OUTPUT_DIR}`);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
