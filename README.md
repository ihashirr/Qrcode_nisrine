# Barcode Control Room

Minimal system for **Sweets and Bakery Pistachio and Cashew L.L.C-O.P.C.** to generate
and manage composite barcode label assets: 9 "Mix Sweet" units + 4 "Pastries" units = 13
images, each combining the master logo, the master product photo, and a freshly rendered
Code128 barcode.

## Structure

```
products.json     master data source: internal barcode strings + category (no DB IDs)
assets/
  logo/           master-logo.png            (you provide this)
  product/        master-product.png         (you provide this)
  output/         generated label PNGs land here (gitignored, regenerable)
src/
  backend/        Fastify + TypeScript API and generation logic
    src/config/products.ts     loads products.json; derives categories + counts
    src/lib/barcode.ts         renders a Code128 barcode to PNG with a quiet zone (bwip-js)
    src/lib/composite.ts       composites logo + product photo + barcode -> label PNG (sharp)
    src/scripts/generateBarcodes.ts   CLI: generate all, or one category
    src/routes/barcodes.ts     REST API used by the frontend
    src/server.ts               Fastify entrypoint
  frontend/       Next.js + Tailwind "Control Room" dashboard (per-category generate + print)
```

## Data source: `products.json`

`products.json` at the repo root is the single source of truth. It holds **only** your
custom internal barcode strings and their category — never database IDs:

```json
{ "internalBarcode": "INT-M1001", "category": "Mix Sweet" }
```

Mix Sweet uses `INT-M1001…INT-M1009`, Pastries uses `INT-P1001…INT-P1004`. Add, remove, or
relabel a product here and everything downstream (categories, counts, generated files, the
dashboard buttons) follows automatically.

## Generation logic

1. **Load.** `config/products.ts` reads `products.json` and groups products by category.
2. **Barcode.** Each product's `internalBarcode` is rendered as a **Code128** symbol — the
   reliable default for retail checkout scanners. `barcode.ts` bakes in a generous
   horizontal **quiet zone** (`paddingwidth`) so the bars never sit against the sticker edge.
3. **Composite.** For every product, `composite.ts` builds a 1000×1250 portrait PNG:
   master logo (top) + master product photo, cover-cropped (middle) + category caption and
   the rendered barcode (bottom). The master assets are read once per run and reused across
   all outputs — only the barcode value and caption change per unit.
4. **Output.** Files are written to `assets/output/` named after the internal barcode, e.g.
   `int-m1001.png`, `int-p1004.png`. The directory is gitignored — treat it as build output.

## Running it

Prereqs: place `master-logo.png` in `assets/logo/` and `master-product.png` in
`assets/product/` (see the README in each folder).

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

The dashboard renders one **Generate <Category> Barcodes** button per category (so today:
"Generate Mix Sweet Barcodes" and "Generate Pastries Barcodes"), shows generation status,
gives a download link per asset, and has a **Print** button.

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
- **Symbology** — Code128 only; the most reliable for retail checkout scanners.
- **Data source** — keep `products.json` clean: custom `internalBarcode` strings, no DB IDs.
- **Printing** — the dashboard's print stylesheet drops the dark UI chrome and renders labels
  at `width: 100%` / `object-fit: contain` so the browser never scales the barcode and ruins
  scan quality.

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
