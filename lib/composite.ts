import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { renderBarcodePng } from "./barcode";
import type { Company } from "./products";

// Bundled brand asset. next.config.js force-includes assets/ in the traced
// output so this path resolves in the serverless/build environment too.
const MASTER_LOGO_PATH = path.join(process.cwd(), "assets", "master-logo.png");

/** Thrown when the master logo is absent. */
export class MasterAssetError extends Error {}

function assertMasterAssets(): void {
  if (!fs.existsSync(MASTER_LOGO_PATH)) {
    throw new MasterAssetError(
      "Missing master asset: assets/master-logo.png. Place the company logo there before generating."
    );
  }
}

/* ── Fixed circular sticker geometry ─────────────────────────────────
 * The physical product label is a circular sticker. Every element sits at
 * absolute coordinates on a fixed canvas so all stickers are identical
 * except for the product name and barcode payload.
 *
 * The design is composed upright (logo at top, barcode at bottom, contact
 * on the bottom arc) and then rotated to match the orientation of the
 * physical label photo: barcode vertical on the left, brand text vertical,
 * logo at the right/center.
 */
const SIZE = 1200; // px — 300dpi ≈ 10cm sticker, high-res for label printers
const C = SIZE / 2; // circle center
const R = 590; // sticker radius
const RING = { radius: 578, width: 5, color: "#d8c98f" }; // khaki rim line

const LOGO = { top: 108, width: 560 };
const TAGLINE = { y: 470, size: 46, color: "#3d8a3d" };
const PRODUCT = { y: 536, size: 54, color: "#8a5a2b" };
const INGREDIENTS_AR = { y: 596, size: 30, color: "#8a5a2b" };
const INGREDIENTS = { firstY: 642, lineHeight: 38, size: 29, color: "#3f3f3f", maxChars: 46 };
const BARCODE = { top: 742, maxWidth: 470, maxHeight: 235 };
const MOBILE_ARC = { radius: 538, size: 33, color: "#2f2f2f" };
const LOCATION_ARC = { radius: 478, size: 33, color: "#b8963e" };

/** Degrees the final flattened sticker is rotated so the output matches the
 * physical label photo (vertical barcode on the left). Set to 0 for an
 * upright preview. */
const OUTPUT_ROTATION = 90;

const FONT = "DejaVu Sans, Helvetica, Arial, sans-serif";

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Greedy word-wrap capped at `maxLines`; overflow gets an ellipsis. */
function wrap(text: string, maxChars: number, maxLines: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= maxChars || !current) {
      current = candidate;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    kept[maxLines - 1] = `${kept[maxLines - 1].slice(0, maxChars - 1)}…`;
    return kept;
  }
  return lines;
}

/**
 * Text along the bottom rim, rendered as individually positioned + rotated
 * characters (librsvg does not support <textPath>). Characters are centered
 * on the 6 o'clock point, letter feet toward the rim, reading left to right
 * — the classic bottom-arc layout on circular labels.
 */
function bottomArcText(text: string, radius: number, fontSize: number, color: string): string {
  const chars = [...text];
  const charWidth = fontSize * 0.68; // avg advance for DejaVu Sans Bold, plus tracking
  const anglePerChar = ((charWidth / radius) * 180) / Math.PI;
  const startAngle = 90 + ((chars.length - 1) / 2) * anglePerChar; // leftmost char

  return chars
    .map((ch, i) => {
      if (ch === " ") return "";
      const theta = ((startAngle - i * anglePerChar) * Math.PI) / 180;
      const x = C + radius * Math.cos(theta);
      const y = C + radius * Math.sin(theta);
      const rotation = (theta * 180) / Math.PI - 90; // baseline tangent to the arc
      return `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" font-family="${FONT}" font-size="${fontSize}"
        font-weight="700" fill="${color}" text-anchor="middle"
        transform="rotate(${rotation.toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)})">${escapeXml(ch)}</text>`;
    })
    .join("\n");
}

export interface BuildLabelInput {
  categoryName: string;
  barcodeValue: string;
  /** Company branding/contact — loaded once by the caller, not per sticker. */
  company: Company;
  ingredients?: string;
  ingredientsAr?: string;
}

/**
 * Draws one circular product sticker: white disc + rim ring, master logo,
 * tagline, product name, ingredients block, barcode, and the contact
 * details on the bottom arc. Only the product name and barcode payload
 * (and optionally ingredients) vary between stickers.
 */
export async function buildLabelImage({
  categoryName,
  barcodeValue,
  company,
  ingredients = "",
  ingredientsAr = "",
}: BuildLabelInput): Promise<Buffer> {
  assertMasterAssets();

  const [logo, barcodeRaw] = await Promise.all([
    sharp(MASTER_LOGO_PATH).resize({ width: LOGO.width, fit: "inside" }).toBuffer(),
    renderBarcodePng(barcodeValue),
  ]);

  const barcode = await sharp(barcodeRaw)
    .resize({ width: BARCODE.maxWidth, height: BARCODE.maxHeight, fit: "inside" })
    .toBuffer();

  const logoMeta = await sharp(logo).metadata();
  const barcodeMeta = await sharp(barcode).metadata();

  const ingredientLines = wrap(ingredients, INGREDIENTS.maxChars, 3);
  const mobiles = `Mob: ${company.contact.mobiles.join(", ")}`;

  const svg = Buffer.from(`
    <svg width="${SIZE}" height="${SIZE}" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
      <!-- sticker disc + rim -->
      <circle cx="${C}" cy="${C}" r="${R}" fill="#ffffff"/>
      <circle cx="${C}" cy="${C}" r="${RING.radius}" fill="none"
              stroke="${RING.color}" stroke-width="${RING.width}"/>

      <!-- brand tagline + dynamic product name -->
      <text x="${C}" y="${TAGLINE.y}" font-family="${FONT}" font-size="${TAGLINE.size}"
            font-weight="700" fill="${TAGLINE.color}" text-anchor="middle">${escapeXml(company.tagline)}</text>
      <text x="${C}" y="${PRODUCT.y}" font-family="${FONT}" font-size="${PRODUCT.size}"
            font-weight="700" fill="${PRODUCT.color}" text-anchor="middle">${escapeXml(categoryName)}</text>

      <!-- ingredients (Arabic line, then wrapped English lines) -->
      ${
        ingredientsAr
          ? `<text x="${C}" y="${INGREDIENTS_AR.y}" font-family="${FONT}" font-size="${INGREDIENTS_AR.size}"
               font-weight="700" fill="${INGREDIENTS_AR.color}" text-anchor="middle" direction="rtl">${escapeXml(ingredientsAr)}</text>`
          : ""
      }
      ${ingredientLines
        .map(
          (line, i) =>
            `<text x="${C}" y="${INGREDIENTS.firstY + i * INGREDIENTS.lineHeight}" font-family="${FONT}"
               font-size="${INGREDIENTS.size}" fill="${INGREDIENTS.color}" text-anchor="middle">${escapeXml(line)}</text>`
        )
        .join("\n")}

      <!-- contact details on the bottom arcs -->
      ${bottomArcText(mobiles, MOBILE_ARC.radius, MOBILE_ARC.size, MOBILE_ARC.color)}
      ${bottomArcText(company.contact.location, LOCATION_ARC.radius, LOCATION_ARC.size, LOCATION_ARC.color)}
    </svg>
  `);

  const upright = await sharp({
    create: { width: SIZE, height: SIZE, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([
      { input: svg, top: 0, left: 0 },
      { input: logo, top: LOGO.top, left: Math.round(C - (logoMeta.width ?? 0) / 2) },
      { input: barcode, top: BARCODE.top, left: Math.round(C - (barcodeMeta.width ?? 0) / 2) },
    ])
    .png()
    .toBuffer();

  // Rotate the flattened disc to the physical label's orientation.
  return sharp(upright).rotate(OUTPUT_ROTATION).png().withMetadata({ density: 300 }).toBuffer();
}
