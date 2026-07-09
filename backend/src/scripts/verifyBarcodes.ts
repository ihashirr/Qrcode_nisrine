import { AuditError, getCategories, getProducts } from "../config/products";
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

  const perGtin = new Map<string, { category: string; count: number }>();
  for (const p of products) {
    const entry = perGtin.get(p.gtin);
    if (entry) entry.count += 1;
    else perGtin.set(p.gtin, { category: p.category, count: 1 });
  }

  for (const [gtin, { category, count }] of perGtin) {
    console.log(`GTIN ${gtin}  →  ${category} (${count} sticker${count === 1 ? "" : "s"})`);
    console.log(`  database: ${verificationUrl(gtin)}`);
    console.log(`  google:   ${googleVerificationUrl(gtin)}\n`);
  }

  console.log(
    `${categories.length} product lines, ${products.length} stickers, ${perGtin.size} distinct GTIN(s).`
  );
}

try {
  main();
} catch (err) {
  // The whole point of this tool is a readable verdict — audit failures
  // print as the one-line conflict message, not a stack trace.
  console.error(err instanceof AuditError ? err.message : err);
  process.exit(1);
}
