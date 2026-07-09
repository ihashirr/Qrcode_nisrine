import path from "node:path";

// Repo layout is fixed: src/backend/src/lib -> ../../../.. == repo root.
export const REPO_ROOT = path.resolve(__dirname, "..", "..", "..", "..");
export const ASSETS_DIR = path.join(REPO_ROOT, "assets");
export const PRODUCTS_JSON = path.join(REPO_ROOT, "products.json");
export const USED_BARCODES_LOG = path.join(REPO_ROOT, "used_barcodes.log");

export const MASTER_LOGO_PATH = path.join(ASSETS_DIR, "logo", "master-logo.png");
export const MASTER_PRODUCT_PATH = path.join(ASSETS_DIR, "product", "master-product.png");
export const OUTPUT_DIR = path.join(ASSETS_DIR, "output");
