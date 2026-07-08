import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { renderBarcodePng } from "./barcode";
import { MASTER_LOGO_PATH, MASTER_PRODUCT_PATH, REPO_ROOT } from "./paths";

/** Thrown when a required master asset is absent — mapped to a 400 by the API. */
export class MasterAssetError extends Error {}

function assertMasterAssets(): void {
  const missing = [MASTER_LOGO_PATH, MASTER_PRODUCT_PATH].filter((p) => !fs.existsSync(p));
  if (missing.length > 0) {
    const names = missing.map((p) => path.relative(REPO_ROOT, p)).join(", ");
    throw new MasterAssetError(
      `Missing master asset(s): ${names}. Place master-logo.png in assets/logo/ and master-product.png in assets/product/ before generating.`
    );
  }
}

const CANVAS = { width: 1000, height: 1250 };
const LOGO_BAND = { top: 40, height: 180 };
const PHOTO_BAND = { top: 240, height: 600, width: 900, left: 50 };
const CAPTION_BAND = { top: 860, height: 70 };
const BARCODE_BAND = { top: 940 };

// The barcode itself renders its human-readable value beneath the bars
// (includetext: true in barcode.ts), so this caption only needs the
// category name — duplicating the code here would visually collide with it.
function captionSvg(categoryName: string) {
  return Buffer.from(`
    <svg width="${CANVAS.width}" height="${CAPTION_BAND.height}" xmlns="http://www.w3.org/2000/svg">
      <text x="50%" y="50" font-family="Helvetica, Arial, sans-serif" font-size="42"
            font-weight="700" fill="#111111" text-anchor="middle">${categoryName}</text>
    </svg>
  `);
}

export interface BuildLabelInput {
  categoryName: string;
  barcodeValue: string;
}

/**
 * Composites the master logo + master product photo + a freshly rendered
 * barcode into a single portrait label PNG. Every generated asset shares
 * this exact layout — only the barcode value and category caption change.
 */
export async function buildLabelImage({ categoryName, barcodeValue }: BuildLabelInput): Promise<Buffer> {
  assertMasterAssets();

  const [logo, photo, barcode] = await Promise.all([
    sharp(MASTER_LOGO_PATH).resize({ height: LOGO_BAND.height, fit: "inside" }).toBuffer(),
    sharp(MASTER_PRODUCT_PATH)
      .resize({ width: PHOTO_BAND.width, height: PHOTO_BAND.height, fit: "cover" })
      .toBuffer(),
    renderBarcodePng(barcodeValue),
  ]);

  const logoMeta = await sharp(logo).metadata();
  const barcodeMeta = await sharp(barcode).metadata();

  const base = sharp({
    create: {
      width: CANVAS.width,
      height: CANVAS.height,
      channels: 3,
      background: "#ffffff",
    },
  });

  return base
    .composite([
      {
        input: logo,
        top: LOGO_BAND.top,
        left: Math.round((CANVAS.width - (logoMeta.width ?? 0)) / 2),
      },
      {
        input: photo,
        top: PHOTO_BAND.top,
        left: PHOTO_BAND.left,
      },
      {
        input: barcode,
        top: BARCODE_BAND.top,
        left: Math.round((CANVAS.width - (barcodeMeta.width ?? 0)) / 2),
      },
      {
        input: captionSvg(categoryName),
        top: CAPTION_BAND.top,
        left: 0,
      },
    ])
    .png()
    .toBuffer();
}
