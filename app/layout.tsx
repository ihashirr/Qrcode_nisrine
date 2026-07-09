import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Barcode Control Room",
  description:
    "Generate and manage barcode label assets for Sweets and Bakery Pistachio and Cashew L.L.C-O.P.C.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-white text-neutral-900 antialiased">{children}</body>
    </html>
  );
}
