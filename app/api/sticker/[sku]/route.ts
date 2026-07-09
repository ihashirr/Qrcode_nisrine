import { NextResponse } from "next/server";
import { buildLabelImage } from "@/lib/composite";
import { getCompany, getProducts, getProductBySku, stickerFile } from "@/lib/products";

// Pre-rendered at build for every known SKU and served as an immutable static
// asset — no sharp at runtime, no cold starts. Unknown SKUs 404 rather than
// generating on demand.
export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
  return getProducts().map((p) => ({ sku: stickerFile(p.sku) }));
}

export async function GET(_req: Request, { params }: { params: { sku: string } }) {
  const sku = params.sku.replace(/\.png$/i, "");
  const product = getProductBySku(sku);
  if (!product) {
    return NextResponse.json({ error: `unknown sticker "${params.sku}"` }, { status: 404 });
  }

  const png = await buildLabelImage({
    categoryName: product.category,
    barcodeValue: product.gtin,
    company: getCompany(),
    ingredients: product.ingredients,
    ingredientsAr: product.ingredientsAr,
  });

  return new NextResponse(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
