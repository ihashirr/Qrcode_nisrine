"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

interface Category {
  name: string;
  slug: string;
  count: number;
}

interface Product {
  sku: string;
  category: string;
  gtin: string;
  file: string;
  verifyUrl: string;
}

/** Every sticker is served, pre-rendered, from the sticker route handler. */
const assetUrl = (file: string) => `/api/sticker/${file}`;

function BarcodeMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden>
      <rect x="2" y="4" width="2" height="16" />
      <rect x="6" y="4" width="1" height="16" />
      <rect x="9" y="4" width="3" height="16" />
      <rect x="14" y="4" width="1" height="16" />
      <rect x="17" y="4" width="2" height="16" />
      <rect x="21" y="4" width="1" height="16" />
    </svg>
  );
}

export default function ControlRoom() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [files, setFiles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/catalog", { cache: "no-store" });
      if (!res.ok) throw new Error("catalog error");
      const data = (await res.json()) as { categories: Category[]; products: Product[]; files: string[] };
      setCategories(data.categories);
      setProducts(data.products);
      setFiles(data.files);
      setError(null);
    } catch {
      setError("Could not load the sticker catalog.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Close the preview with Escape.
  useEffect(() => {
    if (!preview) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setPreview(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [preview]);

  /** filename -> product (with category slug), for captions and filtering. */
  const fileProduct = useMemo(() => {
    const map = new Map<string, Product & { slug: string }>();
    for (const p of products) {
      const slug = p.category.toLowerCase().replace(/\s+/g, "-");
      map.set(p.file, { ...p, slug });
    }
    return map;
  }, [products]);

  const visibleFiles = useMemo(
    () => (filter === "all" ? files : files.filter((f) => fileProduct.get(f)?.slug === filter)),
    [files, filter, fileProduct]
  );

  const total = categories.reduce((sum, c) => sum + c.count, 0);

  return (
    <main className="mx-auto max-w-6xl px-6 pb-16">
      {/* ── Header ─────────────────────────────────────────────── */}
      <header className="no-print sticky top-0 z-10 -mx-6 mb-8 border-b border-neutral-200 bg-white/80 px-6 py-4 backdrop-blur">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <motion.div
              initial={{ rotate: -8, scale: 0.8, opacity: 0 }}
              animate={{ rotate: 0, scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 260, damping: 18 }}
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-yellow-400 text-neutral-900 shadow-sm"
            >
              <BarcodeMark />
            </motion.div>
            <div>
              <h1 className="text-base font-bold tracking-tight">Barcode Control Room</h1>
              <p className="text-xs text-neutral-500">
                Sweets and Bakery Pistachio and Cashew L.L.C-O.P.C.
              </p>
            </div>
          </div>
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => window.print()}
            disabled={files.length === 0}
            className="rounded-lg border border-neutral-300 px-4 py-2 text-xs font-bold uppercase tracking-wide text-neutral-700 transition-colors hover:border-yellow-400 hover:bg-yellow-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Print
          </motion.button>
        </div>
      </header>

      {/* ── Error banner ───────────────────────────────────────── */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="no-print mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
            role="alert"
          >
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Category cards ─────────────────────────────────────── */}
      <section className="no-print mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {loading
          ? [...Array(3)].map((_, i) => (
              <div key={i} className="h-28 animate-pulse rounded-2xl border border-neutral-200 bg-neutral-50" />
            ))
          : categories.map((c, i) => (
              <motion.div
                key={c.slug}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.07 }}
                whileHover={{ y: -3 }}
                className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
              >
                <div className="mb-1 font-mono text-[11px] uppercase tracking-widest text-neutral-400">
                  {c.slug}
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="text-lg font-bold">{c.name}</span>
                  <span className="rounded-full bg-yellow-100 px-2.5 py-0.5 text-xs font-semibold text-yellow-800">
                    {c.count} units
                  </span>
                </div>
              </motion.div>
            ))}

        {!loading && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: categories.length * 0.07 }}
            className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm"
          >
            <div className="mb-1 font-mono text-[11px] uppercase tracking-widest text-neutral-400">
              catalog
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold tabular-nums">{total}</span>
              <span className="text-sm text-neutral-500">
                stickers · {categories.length} product lines
              </span>
            </div>
          </motion.div>
        )}
      </section>

      {/* ── Filter tabs ────────────────────────────────────────── */}
      {!loading && files.length > 0 && (
        <div className="no-print mb-6 flex items-center gap-1 border-b border-neutral-200">
          {[{ name: "All", slug: "all", count: files.length }, ...categories].map((tab) => (
            <button
              key={tab.slug}
              onClick={() => setFilter(tab.slug)}
              className={`relative px-4 py-2.5 text-xs font-bold uppercase tracking-wide transition-colors ${
                filter === tab.slug ? "text-neutral-900" : "text-neutral-400 hover:text-neutral-600"
              }`}
            >
              {tab.name}
              <span className="ml-1.5 font-mono text-[10px] text-neutral-400">
                {tab.slug === "all"
                  ? files.length
                  : files.filter((f) => fileProduct.get(f)?.slug === tab.slug).length}
              </span>
              {filter === tab.slug && (
                <motion.div
                  layoutId="tab-underline"
                  className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-yellow-400"
                />
              )}
            </button>
          ))}
        </div>
      )}

      {/* ── Sticker grid ───────────────────────────────────────── */}
      {loading ? (
        <section className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="aspect-square animate-pulse rounded-2xl border border-neutral-200 bg-neutral-50" />
          ))}
        </section>
      ) : (
        <section className="print-sheet grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          <AnimatePresence mode="popLayout">
            {visibleFiles.map((f, i) => (
              <motion.figure
                key={f}
                layout
                initial={{ opacity: 0, scale: 0.92 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.92 }}
                transition={{ delay: i * 0.02, type: "spring", stiffness: 220, damping: 22 }}
                whileHover={{ y: -4 }}
                className="label-card group overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm transition-shadow hover:shadow-lg"
              >
                {/* object-fit: contain keeps the barcode from being scaled and
                    distorted — critical for scan quality at print time. */}
                <button
                  onClick={() => setPreview(f)}
                  className="block w-full cursor-zoom-in p-2"
                  aria-label={`Preview ${f}`}
                >
                  <img
                    src={assetUrl(f)}
                    alt={f}
                    loading="lazy"
                    className="label-img aspect-square w-full"
                    style={{ objectFit: "contain" }}
                  />
                </button>
                <figcaption className="no-print flex items-center justify-between gap-2 border-t border-neutral-100 px-3 py-2">
                  <span className="min-w-0">
                    <span className="block truncate font-mono text-[11px] text-neutral-600">{f}</span>
                    <span className="block truncate font-mono text-[10px] text-neutral-400">
                      GTIN {fileProduct.get(f)?.gtin ?? "—"}
                    </span>
                  </span>
                  <a
                    href={assetUrl(f)}
                    download={f}
                    className="shrink-0 rounded-md bg-yellow-400 px-2 py-1 text-[10px] font-bold uppercase text-neutral-900 opacity-0 transition-opacity duration-150 hover:bg-yellow-300 group-hover:opacity-100"
                  >
                    Download
                  </a>
                </figcaption>
              </motion.figure>
            ))}
          </AnimatePresence>
        </section>
      )}

      {/* ── Preview lightbox ───────────────────────────────────── */}
      <AnimatePresence>
        {preview && (() => {
          const previewProduct = fileProduct.get(preview);
          return (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setPreview(null)}
              className="no-print fixed inset-0 z-30 flex items-center justify-center bg-neutral-900/70 p-6 backdrop-blur-sm"
            >
              <motion.div
                initial={{ scale: 0.9, y: 12 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.9, y: 12 }}
                transition={{ type: "spring", stiffness: 260, damping: 24 }}
                onClick={(e) => e.stopPropagation()}
                className="max-h-full w-full max-w-xl overflow-hidden rounded-3xl bg-white shadow-2xl"
              >
                <img
                  src={assetUrl(preview)}
                  alt={preview}
                  className="w-full"
                  style={{ objectFit: "contain" }}
                />
                <div className="flex items-center justify-between gap-3 border-t border-neutral-100 px-5 py-3">
                  <span className="min-w-0">
                    <span className="block truncate font-mono text-xs text-neutral-600">{preview}</span>
                    <span className="block truncate font-mono text-[11px] text-neutral-400">
                      GTIN {previewProduct?.gtin ?? "—"}
                    </span>
                  </span>
                  <div className="flex shrink-0 items-center gap-2">
                    {previewProduct?.verifyUrl && (
                      <a
                        href={previewProduct.verifyUrl}
                        target="_blank"
                        rel="noreferrer"
                        title="Check this GTIN against the International Barcodes Database"
                        className="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-bold uppercase text-neutral-700 hover:border-yellow-400 hover:bg-yellow-50"
                      >
                        Verify ↗
                      </a>
                    )}
                    <a
                      href={assetUrl(preview)}
                      download={preview}
                      className="rounded-lg bg-yellow-400 px-3 py-1.5 text-xs font-bold uppercase text-neutral-900 hover:bg-yellow-300"
                    >
                      Download
                    </a>
                    <button
                      onClick={() => setPreview(null)}
                      className="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-bold uppercase text-neutral-700 hover:bg-neutral-50"
                    >
                      Close
                    </button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          );
        })()}
      </AnimatePresence>
    </main>
  );
}
