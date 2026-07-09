# Barcode Control Room

Minimal system for **Sweets and Bakery Pistachio and Cashew L.L.C-O.P.C.** to generate,
manage, and verify the company's **circular product stickers**: 9 "Mix Sweet" units + 4
"Pastries" units = 13 high-resolution stickers, each uniquely identified and retail-compliant,
replicating the physical label — logo, Arabic/English branding, ingredients, vertical barcode
with serial, and contact details on the rim arc.

**Status:** ✅ All 13 stickers generated and tested. Ready for deployment to Vercel.

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

## What Happens When You Scan a Barcode

When a customer or retailer scans one of your product stickers:

1. **Barcode Read** — The scanner reads the EAN-13 barcode (one of your two registered GTINs:
   `0721688020981` for Mix Sweet or `0721688020998` for Pastries).
2. **Database Lookup** — The scanner queries the International Barcodes Database with the GTIN.
3. **Product Info** — If the GTIN is registered, the database returns:
   - Product name ("Mix Sweet" or "Pastries")
   - Company name ("Sweets and Bakery Pistachio and Cashew L.L.C-O.P.C.")
   - Product photo (the official master-product.png)
   - Ingredients and contact details
4. **Your Internal System** — The serial (printed below the barcode as "Serial: NNN") allows you
   to track individual stickers for inventory. Each sticker is uniquely identified by:
   **GTIN + Serial** (e.g., 0721688020981 + 005 = a specific Mix Sweet unit).

**Before scanning works:** You must complete the **Registration** step below.

## Complete Workflow: From Generation to Live Scanning

### Phase 1: Generation ✅ DONE
**What was completed:**
- All 13 circular stickers generated with absolute coordinate geometry (1200×1200 @ 300 DPI)
- Each sticker includes:
  - Master company logo (Pistachio & Cashew branding)
  - Dynamic product name (Mix Sweet or Pastries)
  - Arabic and English ingredients
  - EAN-13 barcode (numeric GTIN: 0721688020981 or 0721688020998)
  - **Serial number** (e.g., "Serial: 001") printed below barcode for individual tracking
  - Contact details curved along bottom arc
- Pre-assignment audit runs at build time: invalid GTINs prevent deployment
- All stickers pre-rendered at build time; served as immutable static PNGs

**Model:** 2 GTINs + per-item serial (retail-compliant)
- **GTIN** (EAN-13): Identifies the product line (shared across all Mix Sweet or all Pastries)
- **Serial** (001–009 for Mix Sweet, 001–004 for Pastries): Identifies individual labels
- **Combined GTIN + Serial:** Uniquely identifies one sticker for inventory

**Generated files:**
```
lib/products.ts         Pre-assignment audit (validates every GTIN, check-digit, serials)
lib/barcode.ts          EAN-13/UPC-A renderer (bwip-js)
lib/composite.ts        Circular sticker compositor (sharp)
app/api/catalog/route.ts   GET /api/catalog (JSON: categories, products, files)
app/api/sticker/[sku]/route.ts   GET /api/sticker/{sku}.png (immutable 300-dpi PNG)
products.json           Authority on all barcode data (13 products, 2 GTINs, serials)
```

### Phase 2: Deployment to Vercel ⏳ NEXT STEP
**What you must do:**
1. **GitHub default branch:** Set `main` as default in repo settings
   - Repo → Settings → General → Default branch → `main`
2. **Connect to Vercel:**
   - Import this repo into Vercel (create a new project)
   - Root Directory: `.` (default)
   - Framework: Next.js (auto-detected)
   - Deploy
3. **Verify the deployment:**
   - Visit `https://<your-vercel-deployment>.vercel.app`
   - You should see the Barcode Control Room dashboard
   - Click on stickers to preview; each shows GTIN + Serial
   - Download one sticker to confirm it's a valid PNG

**Deployment configuration is already ready:**
- `vercel.json` forces Next.js builder (prevents "No Output Directory" error)
- `next.config.js` includes sharp and traces all assets
- `products.json` and `assets/master-logo.png` are committed to git (will be deployed)

### Phase 3: Product Registration 📋 PENDING
**What you must do:**
1. **Register both GTINs with the International Barcodes Database:**
   - Visit https://www.gs1.org/services/gs1-barcode-database (or your regional IBN office)
   - Register `0721688020981` (Mix Sweet) with:
     - Product name: "Mix Sweet"
     - Company: "Sweets and Bakery Pistachio and Cashew L.L.C-O.P.C."
     - Photo: Use `assets/master-product.png` (the official product photo)
     - Ingredients: As listed in products.json
   - Register `0721688020998` (Pastries) with:
     - Product name: "Pastries"
     - Company: "Sweets and Bakery Pistachio and Cashew L.L.C-O.P.C."
     - Photo: Use `assets/master-product.png`
     - Ingredients: As listed in products.json
2. **Proof of ownership:** The database may request proof (certificate of GTIN assignment from UAE-1806).

**Why:** Without registration, scanners can find nothing when they query the database.
After registration, the GTINs become internationally searchable.

### Phase 4: Apply Stickers to Product Packaging ✋ YOUR RESPONSIBILITY
**What you must do:**
1. Download all 13 stickers from the Vercel dashboard:
   - Click any sticker card → Download button
   - Or download directly from: `/api/sticker/{sku}.png` (e.g., `/api/sticker/int-m1001.png`)
2. Print each sticker:
   - **Resolution:** 300 DPI (embedded in PNG)
   - **Size:** ~10 cm diameter (1200×1200 pixels at 300 DPI)
   - **Material:** High-quality label stock (matte or glossy)
3. Apply the sticker to the physical product packaging (one sticker per unit).

### Phase 5: Live Scanning 🎯 FINAL OUTCOME
**What happens when a customer scans:**
1. Scanner reads the barcode (e.g., 0721688020981)
2. Scanner queries the International Barcodes Database
3. Database returns product info (name, company, photo, ingredients) — **ONLY IF REGISTERED**
4. Your internal system uses the **Serial** to track that specific unit in inventory

**What the customer sees:**
- Product name and company on their scanner/phone
- Photo and ingredients
- Contact information

**Example:**
```
Item Scanned:
  Name: Mix Sweet
  Company: Sweets and Bakery Pistachio and Cashew L.L.C-O.P.C.
  Photo: [master-product.png]
  Ingredients: Semolina flour, coconut, sugar, baking powder, pistachios
  Contact: +971 55 235 6655, Abu Dhabi - U.A.E

(Your internal system also logs: GTIN 0721688020981 + Serial 005 = Unit #5 of Mix Sweet)
```

## What Remains To Do (User Checklist)

| Task | Status | Owner | Notes |
|------|--------|-------|-------|
| Deploy to Vercel | ⏳ Pending | You | Connect repo to Vercel, set main as default branch |
| Register 2 GTINs in International Barcodes Database | ⏳ Pending | You | Submit proof of ownership, product photos, ingredients |
| Print and apply stickers to products | ⏳ Pending | You | Download from dashboard, print at 300 DPI, apply to packages |
| Test scanning in production | ⏳ Pending | You | Scan a sticker; verify product info returns from database |
| Verify Vercel dashboard is live | ⏳ Pending | You | Visit deployed URL, preview stickers, download a sample |

## Setup & Local Development

If you need to modify products, regenerate stickers, or test locally before production:

### Development
```bash
npm install
npm run dev      # http://localhost:3000 — live dashboard and preview
```

### Production Build (Pre-renders all 13 stickers)
```bash
npm run build    # Runs the pre-assignment audit; fails if any GTIN is invalid
npm start        # Serve the production build locally
```

### Editing Products
Edit `products.json` directly:
- **sku:** Internal identifier (never changes after first print)
- **category:** "Mix Sweet" or "Pastries"
- **gtin:** Must be in `company.assignedGtins` and pass check-digit validation
- **serial:** Unique within its GTIN (001–009 for Mix Sweet, 001–004 for Pastries)
- **ingredients/ingredientsAr:** Override defaults per product (optional)

Save and rebuild; all 13 stickers regenerate automatically.

### Audit Rules (Enforced at build)
If any rule fails, the build aborts with `Conflict detected: Invalid or duplicate barcode number`:

1. **Data source as authority** — only numbers in `products.json` can be printed
2. **Placeholder block** — `INT-` codes or non-numeric GTINs trigger placeholder detection
3. **Check-digit validation** — every GTIN must pass EAN-13 math (12-digit UPC-A also accepted)
4. **Allowlist enforcement** — every GTIN must appear in `company.assignedGtins`
5. **Category-to-GTIN mapping** — same GTIN cannot be used for two different categories
6. **Serial uniqueness** — same serial cannot be used twice within one GTIN
7. **Duplicate SKUs** — two products cannot have the same SKU

## Verification: How to Check Your GTINs

The dashboard has a **Verify ↗** link on each sticker (visible in the preview lightbox):

1. Click any sticker to open the preview
2. Click **Verify ↗** button
3. Opens the International Barcodes Database search pre-filled with your GTIN
4. If registered, you'll see product info; if not yet registered, you'll get "no results"

**Do this after registering** to confirm your GTINs are live in the database.

## Post-generation workflow

Generating the images is only the first step. To make the barcodes official and
internationally searchable, the numbers move through the following lifecycle:

1. **Generation** ✅ — All 13 stickers are already generated and tested.
2. **Deployment** ⏳ — Push to Vercel and verify the dashboard is live.
3. **Registration** ⏳ — Submit both GTINs to the International Barcodes Database.
4. **Product Application** ⏳ — Print stickers and apply to product packaging.
5. **Live Scanning** 🎯 — Customers scan stickers; database returns product info; you track
   inventory by Serial number.
