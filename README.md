# Barcode Control Room

Minimal system for **Sweets and Bakery Pistachio and Cashew L.L.C-O.P.C.** to generate
and manage the company's **circular product sticker**: 9 "Mix Sweet" units + 4 "Pastries"
units = 13 high-resolution stickers, each replicating the physical label — logo, Arabic/
English branding, ingredients, vertical barcode, and contact details on the rim arc.

## Structure

```
products.json     master data source: barcode payloads, categories, ingredients, contact info
assets/
  logo/           master-logo.png            (official company logo)
  product/        master-product.png         (official product photo — used for the
                                              digital catalog / database registration)
  output/         the 13 generated sticker PNGs (committed deliverables)
src/
  backend/        Fastify + TypeScript API and generation logic
    src/config/products.ts     loads + validates products.json; derives categories
    src/lib/barcode.ts         renders EAN-13/UPC-A (numeric GTINs) or Code128 (bwip-js)
    src/lib/composite.ts       draws the circular sticker: disc, logo, texts, arcs, barcode
    src/scripts/generateBarcodes.ts   CLI: generate all, or one category
    src/routes/barcodes.ts     REST API used by the frontend
    src/server.ts               Fastify entrypoint
  frontend/       Next.js + Tailwind + framer-motion "Control Room" dashboard
```

## Data source: `products.json`

`products.json` at the repo root is the single source of truth — barcode payloads and
categories per product, plus company contact details and default ingredients. No DB IDs:

```json
{ "internalBarcode": "INT-M1001", "category": "Mix Sweet" }
```

Mix Sweet uses `INT-M1001…INT-M1009`, Pastries uses `INT-P1001…INT-P1004`. Add, remove, or
relabel a product here and everything downstream (categories, counts, generated files, the
dashboard buttons) follows automatically. Products can override `ingredients` /
`ingredientsAr` individually; otherwise the file-level `defaults` apply. **When the official
GTIN series is assigned, paste the 12/13-digit numbers into `internalBarcode` — the renderer
switches to EAN-13/UPC-A automatically.**

## The circular sticker (generation logic)

The output replicates the physical product label: a circular sticker, drawn with **absolute
coordinates** on a fixed 1200×1200 canvas (300 DPI ≈ 10 cm) so every element lands in the
same position on all 13 stickers. Only the product name and barcode payload change.

1. **Disc + rim** — white circle with the khaki rim ring, transparent outside the circle.
2. **Logo** — the master logo (emblem + Arabic/English brand names) at the top.
3. **Texts** — "Sweets & Bakery" tagline (green), dynamic product name (brown), Arabic +
   English ingredients lines, all centered with fixed coordinates.
4. **Barcode** — rendered by bwip-js with the quiet zone baked in; EAN-13/UPC-A for numeric
   GTINs, Code128 otherwise.
5. **Contact arcs** — "Mob: +971 55 235 6655, +971 50 181 3507" and "Abu Dhabi - U.A.E"
   curved along the bottom rim. (Drawn as per-character positioned/rotated glyphs because
   librsvg's `<textPath>` is unsupported in this environment.)
6. **Rotation** — the finished disc is rotated 90° so the file matches the physical label's
   orientation: barcode vertical on the left, brand text vertical, logo at the right. Set
   `OUTPUT_ROTATION = 0` in `composite.ts` for an upright variant — a circle prints the
   same either way.

Files are written to `assets/output/` named after the barcode payload, e.g. `int-m1001.png`.
The 13 stickers are committed as the project's deliverables and are fully regenerable.

## Running it

The master assets ship in the repo (`assets/logo/master-logo.png`,
`assets/product/master-product.png`), so generation works out of the box.

```bash
# Backend
cd src/backend
npm install
npm run generate               # generate all 13 PNGs into assets/output/
npm run generate "Pastries"    # or just one category
npm run dev                    # run the API on :4000

# Frontend (separate terminal)
cd src/frontend
npm install
npm run dev                    # Control Room dashboard on :3000
```

The dashboard renders one **Generate <Category> Barcodes** button per category plus
**Generate All**, shows an animated generation progress bar, filters the sticker grid by
category, opens a full-size preview lightbox on click (Esc to close), gives a download
link per sticker, and has a **Print** button.

## API

| Method | Path                                | Purpose                                   |
|--------|-------------------------------------|-------------------------------------------|
| GET    | `/api/categories`                   | Categories + counts (derived from data)   |
| GET    | `/api/products`                     | Raw product list                          |
| GET    | `/api/barcodes`                     | List generated PNG filenames              |
| POST   | `/api/barcodes/generate`            | Regenerate all assets                     |
| POST   | `/api/barcodes/generate/:category`  | Regenerate one category (slug)            |
| GET    | `/assets/output/:filename`          | Serve a generated PNG                     |

## Production checklist

- **Quiet zone** — barcodes carry ≥5mm of clear space on each side (baked in via bwip-js
  `paddingwidth`). Scanners fail without it.
- **Symbology** — EAN-13/UPC-A once the GTIN series is assigned (auto-detected from numeric
  payloads); Code128 for the interim internal codes. Both are retail-scanner reliable.
- **Data source** — keep `products.json` clean: barcode payloads only, no DB IDs.
- **Printing** — stickers are 300 DPI PNGs sized for a ~10 cm label; the dashboard's print
  stylesheet renders them at `width: 100%` / `object-fit: contain` so the browser never
  scales the barcode and ruins scan quality.

## Master brand assets

The two images in `assets/` are the master brand assets:

- `assets/logo/master-logo.png` — the official Pistachio & Cashew logo, composited onto
  every sticker (carries the Arabic + English brand names)
- `assets/product/master-product.png` — the official product photo (cropped to remove the
  camera watermark); the physical sticker doesn't carry it, but it is the official visual
  for the digital catalog and database registration below

Beyond the labels themselves, these images serve as:

- **Product packaging** — printed with the barcode on physical labels for both product lines
- **Digital product catalog** — uploaded as the official visual reference for each GTIN when
  registering in the International Barcodes Database
- **SEO** — the database registration recommends high-quality photos to increase product
  visibility in search engines

Because compositing is centralized, swapping the master logo and regenerating restyles
all 13 stickers consistently — the scanned product always presents the correct brand identity.

## Post-generation workflow

Generating the images is only the first step. To make the barcodes official and
internationally searchable, the numbers move through the following lifecycle:

1. **Generation** — Run this project's script to generate the unique GTIN barcode images
   from the number series assigned to you (Mix Sweet and Pastries).
2. **Product application** — Apply the generated barcode images to the product packaging for
   "Mix Sweet" and "Pastries".
3. **Registration** — Once the products are ready, submit those specific generated barcode
   numbers to the **International Barcodes Database** for official registration.
4. **Verification** — After you provide proof of ownership and complete the registration, the
   database links those numbers to **Sweets and Bakery Pistachio and Cashew L.L.C-O.P.C.**,
   making them internationally searchable.
