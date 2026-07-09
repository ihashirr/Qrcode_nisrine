import { NextResponse } from "next/server";
import { getCategories, getProducts, stickerFile, verificationUrl } from "@/lib/products";

// Static: evaluated once at build. The pre-assignment audit runs here (in
// getProducts/getCategories) — an invalid or conflicting GTIN fails the build.
export const dynamic = "force-static";

export function GET() {
  const products = getProducts().map((p) => ({
    sku: p.sku,
    category: p.category,
    gtin: p.gtin,
    serial: p.serial,
    file: stickerFile(p.sku),
    verifyUrl: verificationUrl(p.gtin),
  }));

  return NextResponse.json({
    categories: getCategories(),
    products,
    files: products.map((p) => p.file).sort(),
  });
}
