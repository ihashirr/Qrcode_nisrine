// Bridges the local generation pipeline to the static, backend-free web app.
//
// Reads the repo's products.json + the committed stickers in assets/output/
// and materializes them INTO the Next app: a catalog.json (categories,
// products, GTINs, verify links) and public/stickers/*.png. The deployed
// site then needs no Fastify server — it just serves these static files.
//
// Runs automatically before `dev` and `build` (see package.json). It is
// tolerant: if the repo assets aren't reachable (e.g. a Vercel build that
// only checked out this subdirectory), it leaves the already-committed
// copies in place instead of failing.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const FRONTEND = path.resolve(here, "..");
const REPO_ROOT = path.resolve(FRONTEND, "..");
const PRODUCTS_JSON = path.join(REPO_ROOT, "products.json");
const OUTPUT_DIR = path.join(REPO_ROOT, "assets", "output");
const PUBLIC = path.join(FRONTEND, "public");
const STICKERS_OUT = path.join(PUBLIC, "stickers");
const CATALOG_OUT = path.join(PUBLIC, "catalog.json");

// Mirror of the backend's verificationUrl helper.
const verifyUrl = (gtin) => `https://barcodesdatabase.org/?s=${encodeURIComponent(gtin)}`;
const slugify = (s) => s.toLowerCase().replace(/\s+/g, "-");
const fileFor = (sku) => `${sku.toLowerCase()}.png`;

function buildCatalog(products) {
  const order = [];
  const counts = new Map();
  for (const p of products) {
    if (!counts.has(p.category)) order.push(p.category);
    counts.set(p.category, (counts.get(p.category) ?? 0) + 1);
  }
  return {
    categories: order.map((name) => ({ name, slug: slugify(name), count: counts.get(name) })),
    products: products.map((p) => ({
      sku: p.sku,
      category: p.category,
      gtin: String(p.gtin),
      verifyUrl: verifyUrl(String(p.gtin)),
      file: fileFor(p.sku),
    })),
    files: products.map((p) => fileFor(p.sku)).sort(),
  };
}

function main() {
  if (!fs.existsSync(PRODUCTS_JSON)) {
    console.log("[sync-assets] products.json not reachable — keeping committed public assets.");
    return;
  }

  const { products } = JSON.parse(fs.readFileSync(PRODUCTS_JSON, "utf8"));
  const catalog = buildCatalog(products);

  fs.mkdirSync(STICKERS_OUT, { recursive: true });

  let copied = 0;
  let missing = 0;
  for (const file of catalog.files) {
    const src = path.join(OUTPUT_DIR, file);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, path.join(STICKERS_OUT, file));
      copied += 1;
    } else if (!fs.existsSync(path.join(STICKERS_OUT, file))) {
      missing += 1;
      console.warn(`[sync-assets] WARNING: ${file} missing from assets/output and public/stickers`);
    }
  }

  fs.writeFileSync(CATALOG_OUT, `${JSON.stringify(catalog, null, 2)}\n`);
  console.log(
    `[sync-assets] catalog.json written (${catalog.products.length} products), ` +
      `${copied} sticker(s) copied${missing ? `, ${missing} missing` : ""}.`
  );
}

main();
