import { getCategories, getProducts } from "../config/products";
import { googleVerificationUrl, verificationUrl } from "../lib/verify";

/**
 * Prints one verification link per distinct GTIN so each number can be
 * manually confirmed against the International Barcodes Database before
 * generating/printing. Loading the config also runs the pre-assignment
 * audit — if this script prints links, the data source itself is clean.
 */
function main(): void {
  const products = getProducts();
  const categories = getCategories();

  console.log("Pre-assignment audit: PASSED (all GTINs valid, assigned, and conflict-free)\n");
  console.log("Verify each GTIN by clicking the links below — the database entry");
  console.log("must be either empty (unclaimed) or owned by the company:\n");

  const seen = new Set<string>();
  for (const p of products) {
    if (seen.has(p.gtin)) continue;
    seen.add(p.gtin);
    const count = products.filter((x) => x.gtin === p.gtin).length;
    console.log(`GTIN ${p.gtin}  →  ${p.category} (${count} sticker${count === 1 ? "" : "s"})`);
    console.log(`  database: ${verificationUrl(p.gtin)}`);
    console.log(`  google:   ${googleVerificationUrl(p.gtin)}\n`);
  }

  console.log(
    `${categories.length} product lines, ${products.length} stickers, ${seen.size} distinct GTIN(s).`
  );
}

main();
