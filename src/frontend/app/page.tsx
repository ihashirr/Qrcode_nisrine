"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:4000";

interface Category {
  name: string;
  slug: string;
  count: number;
}

/** Extracts the backend's { error } message, falling back to a generic one. */
async function readError(res: Response, fallback: string): Promise<string> {
  try {
    const body = (await res.json()) as { error?: string };
    return body.error ?? fallback;
  } catch {
    return fallback;
  }
}

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
  const [files, setFiles] = useState<string[]>([]);
  const [busy, setBusy] = useState<string | null>(null); // slug | "all" | null
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>();

  const showToast = useCallback((message: string) => {
    setToast(message);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3500);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const [catRes, fileRes] = await Promise.all([
        fetch(`${API_BASE}/api/categories`),
        fetch(`${API_BASE}/api/barcodes`),
      ]);
      if (!catRes.ok || !fileRes.ok) throw new Error("bad response");
      setCategories(await catRes.json());
      setFiles(await fileRes.json());
      setError(null);
    } catch {
      setError("Backend unreachable — start the Fastify server on :4000 (cd src/backend && npm run dev).");
    }
  }, []);

  useEffect(() => {
    refresh();
    return () => clearTimeout(toastTimer.current);
  }, [refresh]);

  const generate = async (slug: string | null, label: string) => {
    setBusy(slug ?? "all");
    setError(null);
    try {
      const url = slug
        ? `${API_BASE}/api/barcodes/generate/${slug}`
        : `${API_BASE}/api/barcodes/generate`;
      const res = await fetch(url, { method: "POST" });
      if (!res.ok) {
        setError(await readError(res, `Generating ${label} failed.`));
        return;
      }
      const body = (await res.json()) as { count: number };
      showToast(`${body.count} ${label} label${body.count === 1 ? "" : "s"} generated`);
      await refresh();
    } catch {
      setError("Generation failed — check the backend logs.");
    } finally {
      setBusy(null);
    }
  };

  const total = categories.reduce((sum, c) => sum + c.count, 0);
  const progress = total > 0 ? Math.min(files.length / total, 1) : 0;

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
          <div className="flex items-center gap-2">
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => generate(null, "total")}
              disabled={busy !== null}
              className="rounded-lg bg-yellow-400 px-4 py-2 text-xs font-bold uppercase tracking-wide text-neutral-900 shadow-sm transition-colors hover:bg-yellow-300 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {busy === "all" ? "Generating…" : "Generate All"}
            </motion.button>
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

      {/* ── Category cards + progress ──────────────────────────── */}
      <section className="no-print mb-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {categories.map((c, i) => (
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
            <div className="mb-4 flex items-baseline justify-between">
              <span className="text-lg font-bold">{c.name}</span>
              <span className="rounded-full bg-yellow-100 px-2.5 py-0.5 text-xs font-semibold text-yellow-800">
                {c.count} units
              </span>
            </div>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => generate(c.slug, c.name)}
              disabled={busy !== null}
              className="w-full rounded-lg bg-neutral-900 px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-yellow-400 transition-colors hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {busy === c.slug ? "Generating…" : `Generate ${c.name} Barcodes`}
            </motion.button>
          </motion.div>
        ))}

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: categories.length * 0.07 }}
          className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm"
        >
          <div className="mb-1 font-mono text-[11px] uppercase tracking-widest text-neutral-400">
            status
          </div>
          <div className="mb-4 flex items-baseline gap-2">
            <span className="text-3xl font-bold tabular-nums">{files.length}</span>
            <span className="text-sm text-neutral-500">/ {total} labels generated</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-neutral-100">
            <motion.div
              className="h-full rounded-full bg-yellow-400"
              initial={false}
              animate={{ width: `${progress * 100}%` }}
              transition={{ type: "spring", stiffness: 120, damping: 20 }}
            />
          </div>
        </motion.div>
      </section>

      {/* ── Asset grid ─────────────────────────────────────────── */}
      {files.length === 0 && !error ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="no-print flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-neutral-200 py-20 text-center"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-yellow-100 text-yellow-600">
            <BarcodeMark />
          </div>
          <p className="text-sm font-semibold">No labels generated yet</p>
          <p className="max-w-sm text-xs text-neutral-500">
            Hit <span className="font-semibold text-neutral-700">Generate All</span> or a category
            button above — the composite labels will appear here, ready to download or print.
          </p>
        </motion.div>
      ) : (
        <section className="print-sheet grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          <AnimatePresence>
            {files.map((f, i) => (
              <motion.figure
                key={f}
                layout
                initial={{ opacity: 0, scale: 0.92 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.92 }}
                transition={{ delay: i * 0.03, type: "spring", stiffness: 220, damping: 22 }}
                whileHover={{ y: -4 }}
                className="label-card group overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm transition-shadow hover:shadow-lg"
              >
                {/* object-fit: contain keeps the barcode from being scaled and
                    distorted — critical for scan quality at print time. */}
                <img
                  src={`${API_BASE}/assets/output/${f}`}
                  alt={f}
                  className="label-img w-full"
                  style={{ objectFit: "contain" }}
                />
                <figcaption className="no-print flex items-center justify-between gap-2 border-t border-neutral-100 px-3 py-2">
                  <span className="truncate font-mono text-[11px] text-neutral-600">{f}</span>
                  <a
                    href={`${API_BASE}/assets/output/${f}`}
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

      {/* ── Toast ──────────────────────────────────────────────── */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.95 }}
            className="no-print fixed bottom-6 left-1/2 z-20 -translate-x-1/2 rounded-full bg-neutral-900 px-5 py-2.5 text-sm font-semibold text-yellow-400 shadow-lg"
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
