import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Barcode Control Room",
  description: "Generate and manage barcode label assets.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="font-mono text-sm">{children}</body>
    </html>
  );
}
