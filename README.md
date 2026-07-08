# Barcode Control Room

Minimal system for **Sweets and Bakery Pistachio and Cashew L.L.C-O.P.C.** to generate
and manage composite barcode label assets: 9 "Mix Sweet" units + 4 "Pastries" units = 13
images, each combining the master logo, the master product photo, and a freshly rendered
barcode.

## Structure

```
assets/
  logo/           master-logo.png            (you provide this)
  product/        master-product.png         (you provide this)
  output/         generated label PNGs land here (gitignored, regenerable)
src/
  backend/        Fastify + TypeScript API and generation logic
    src/config/categories.ts   single source of truth: category names + counts
    src/lib/barcode.ts         renders a Code128 barcode to PNG (bwip-js)
    src/lib/composite.ts       composites logo + product photo + barcode -> label PNG (sharp)
    src/scripts/generateBarcodes.ts   CLI script: generates all 13 assets
    src/routes/barcodes.ts     REST API used by the frontend
    src/server.ts               Fastify entrypoint
  frontend/       Next.js + Tailwind "Control Room" dashboard (view status, trigger generation)
```

## Generation logic

1. **Categories are config, not code.** `src/backend/src/config/categories.ts` lists each
   category's display name, short code, and unit count. Today that's
   `Mix Sweet (MSW, 9)` and `Pastries (PST, 4)`. Adding a category or changing a count is a
   one-line edit — nothing else needs to change.

2. **Barcode payload.** Each unit gets a deterministic Code128 value:
   `<COMPANY_SHORT_CODE>-<CATEGORY_CODE>-<sequence>`, e.g. `SBPC-MSW-01` ... `SBPC-MSW-09`,
   `SBPC-PST-01` ... `SBPC-PST-04`. Code128 was chosen because it encodes arbitrary
   alphanumeric text without a checksum scheme, unlike EAN/UPC.

3. **Compositing.** For every unit, `composite.ts` builds a 1000x1400 portrait PNG:
   - top band: master logo, scaled to fit
   - middle band: master product photo, cover-cropped into a fixed frame
   - bottom band: the rendered barcode, plus an SVG text overlay with the category name
     and the human-readable barcode value

   The master assets are read once per run from `assets/logo/` and `assets/product/` and
   reused across all 13 outputs — only the barcode and caption change per unit.

4. **Output.** Files are written to `assets/output/` as
   `<category-slug>-<sequence>.png` (e.g. `mix-sweet-01.png`, `pastries-04.png`). The
   directory is gitignored — treat it as build output, regenerate it any time the master
   assets or category config change.

## Running it

Prereqs: place `master-logo.png` in `assets/logo/` and `master-product.png` in
`assets/product/` (see the README in each folder).

```bash
# Backend
cd src/backend
npm install
npm run generate      # one-shot: generates all 13 PNGs into assets/output/
npm run dev           # or: run the API on :4000 (POST /api/barcodes/generate does the same)

# Frontend (separate terminal)
cd src/frontend
npm install
npm run dev           # Control Room dashboard on :3000, talks to the backend on :4000
```

## API

| Method | Path                       | Purpose                                  |
|--------|----------------------------|-------------------------------------------|
| GET    | `/api/categories`          | List configured categories + counts        |
| GET    | `/api/barcodes`            | List generated PNG filenames                |
| POST   | `/api/barcodes/generate`   | Regenerate all assets                       |
| GET    | `/assets/output/:filename` | Serve a generated PNG                       |
