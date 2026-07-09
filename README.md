# Barcode Control Room

Minimal system for **Sweets and Bakery Pistachio and Cashew L.L.C-O.P.C.** to generate
and manage the company's **circular product sticker**: 9 "Mix Sweet" units + 4 "Pastries"
units = 13 high-resolution stickers, each replicating the physical label — logo, Arabic/
English branding, ingredients, vertical barcode, and contact details on the rim arc.

## Structure

A single **Next.js app** — no separate backend, no build steps to run. Generation is folded
into API route handlers that Next pre-renders at build time, so it deploys to Vercel with
zero long-running servers.

```
products.json     master data source: GTIN allowlist + per-product assignments (the authority)
assets/
  master-logo.png     official company logo, composited onto every sticker
  master-product.png  official product photo (for the digital catalog / DB registration)
lib/
  products.ts     loads + audits products.json; derives categories; verify links
  barcode.ts      renders EAN-13/UPC-A (numeric GTINs) or Code128 (bwip-js)
  composite.ts    draws the circular sticker: disc, logo, texts, arcs, barcode (sharp)
app/
  page.tsx        the dashboard (filter, preview, verify, download, print)
  api/catalog/route.ts        GET catalog JSON (runs the audit at build)
  api/sticker/[sku]/route.ts  GET the sticker PNG (generated at build, one per SKU)
```

## Data source: `products.json`

`products.json` at the repo root is the **only authority on barcode numbers**. It carries
the company's assigned GTIN allowlist (verbatim from the IBN *Certificate of GTIN
Assignment*, order UAE-1806) and the per-product assignments:

```json
{ "sku": "INT-M1001", "category": "Mix Sweet", "gtin": "0721688020981", "serial": "001" }
```

- `sku` — internal identity, used for filenames/routes; never printed as a barcode
- `gtin` — the registered number printed on the sticker as EAN-13
- `serial` — a per-item number printed discreetly on the sticker (e.g. "001"); unique within
  its GTIN, so **GTIN + serial identifies exactly one label** for internal inventory
- `company.assignedGtins` — the allowlist: `0721688020981` (Mix Sweet) and
  `0721688020998` (Pastries, confirmed registered in the International Barcodes Database)

**Two GTINs + per-item serial (retail-compliant).** A GTIN identifies one *product line*, not
one unit — all 9 Mix Sweet stickers correctly share the Mix Sweet GTIN, all 4 Pastries share
the Pastries GTIN, so a supermarket scans the correct registered product. The `serial` gives
each of the 13 labels its own identity for your inventory without inventing GTINs you don't
own. The certificate assigns **two** GTINs (Quantity: 2); the values between them mostly fail
check-digit math and belong to other companies — never fabricate one. Products can override
`ingredients` / `ingredientsAr` individually; otherwise the file-level `defaults` apply.

## Validation-First workflow

Barcode numbers are treated as a protected asset. Loading `products.json` (`lib/products.ts`)
runs a **pre-assignment audit**; if any rule fails it throws
`Conflict detected: Invalid or duplicate barcode number.`, which **fails the build** — invalid
data can never deploy:

1. **Data source as authority** — only numbers in `products.json` can ever be printed.
2. **Placeholder block** — an `INT-` value (or anything that isn't a 12/13-digit number)
   in a `gtin` field aborts the build.
3. **Check-digit math** — every GTIN must pass GTIN check-digit validation (catches typos
   and fabricated numbers); 12-digit UPC-A values are accepted and canonicalized to GTIN-13.
4. **Allowlist** — every GTIN must appear in `company.assignedGtins` (the certificate).
5. **Conflict detection** — the same GTIN assigned to two *different* categories aborts;
   duplicate SKUs abort; a `serial` reused within the same GTIN aborts.

**External verification** — the dashboard's preview lightbox has a **Verify ↗** link per
sticker that opens the pre-filled International Barcodes Database search, so each number can
be confirmed as owned by the company.

## The circular sticker (generation logic)

The output replicates the physical product label: a circular sticker, drawn with **absolute
coordinates** on a fixed 1200×1200 canvas (300 DPI ≈ 10 cm) so every element lands in the
same position on all 13 stickers. Only the product name and barcode payload change.

1. **Disc + rim** — white circle with the khaki rim ring, transparent outside the circle.
2. **Logo** — the master logo (emblem + Arabic/English brand names) at the top.
3. **Texts** — "Sweets & Bakery" tagline (green), dynamic product name (brown), Arabic +
   English ingredients lines, all centered with fixed coordinates.
4. **Barcode** — rendered by bwip-js with the quiet zone baked in; EAN-13/UPC-A for numeric
   GTINs, Code128 otherwise. A discreet **"Serial: NNN"** is printed below it (outside the
   barcode area) so each label is individually identifiable.
5. **Contact arcs** — "Mob: +971 55 235 6655, +971 50 181 3507" and "Abu Dhabi - U.A.E"
   curved along the bottom rim. (Drawn as per-character positioned/rotated glyphs because
   librsvg's `<textPath>` is unsupported in this environment.)
6. **Rotation** — the finished disc is rotated 90° so the file matches the physical label's
   orientation: barcode vertical on the left, brand text vertical, logo at the right. Set
   `OUTPUT_ROTATION = 0` in `composite.ts` for an upright variant — a circle prints the
   same either way.

Each sticker is served at `/api/sticker/<sku>.png`, e.g. `/api/sticker/int-m1001.png` (SKUs
stay unique per sticker even though a category shares one GTIN). Next pre-renders one static
PNG per SKU at build time, so there is no `sharp` at request time and no stored files to
commit.

## Running it

The master logo ships in the repo (`assets/master-logo.png`), so it works out of the box.
One app, one command:

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # production build — generates all 13 stickers, runs the audit
npm start        # serve the production build
```

The dashboard shows the catalog: category cards, filter tabs, a click-to-zoom preview
lightbox (Esc to close) with per-sticker GTIN and a **Verify ↗** link, per-sticker download,
and **Print**.

## Deploy to Vercel

It's a standard single Next.js app at the repo root, so Vercel needs no special
configuration — **Root Directory = repo root** (the default), framework auto-detected, no
`vercel.json`. Push to the connected branch (or merge to your production branch) and Vercel
builds it:

- `next build` runs the pre-assignment **audit** (a bad GTIN fails the build — nothing
  invalid can ship) and pre-renders all 13 stickers with `sharp` on Vercel's build
  infrastructure.
- The deployed site is fully static + serverless route handlers — **no long-running worker**
  to host or manage.

To update the stickers, edit `products.json` (or swap `assets/master-logo.png`), commit, and
push — the next build regenerates everything.

## API (Next.js route handlers)

| Method | Path                          | Purpose                                        |
|--------|-------------------------------|------------------------------------------------|
| GET    | `/api/catalog`                | Categories, products, GTINs, verify links      |
| GET    | `/api/sticker/<sku>.png`      | The pre-rendered sticker PNG for one SKU        |

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

- `assets/master-logo.png` — the official Pistachio & Cashew logo, composited onto every
  sticker (carries the Arabic + English brand names)
- `assets/master-product.png` — the official product photo (cropped to remove the camera
  watermark); the physical sticker doesn't carry it, but it is the official visual for the
  digital catalog and database registration below

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
