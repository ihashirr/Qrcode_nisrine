"use client";

import { useCallback, useEffect, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:4000";

interface Category {
  name: string;
  slug: string;
  count: number;
}

export default function ControlRoom() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [files, setFiles] = useState<string[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const [catRes, fileRes] = await Promise.all([
        fetch(`${API_BASE}/api/categories`),
        fetch(`${API_BASE}/api/barcodes`),
      ]);
      setCategories(await catRes.json());
      setFiles(await fileRes.json());
    } catch {
      setError("Backend unreachable. Is the Fastify server running on :4000?");
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const generate = async (slug: string) => {
    setBusy(slug);
    setError(null);
    try {
      await fetch(`${API_BASE}/api/barcodes/generate/${slug}`, { method: "POST" });
      await refresh();
    } catch {
      setError("Generation failed. Check backend logs.");
    } finally {
      setBusy(null);
    }
  };

  const total = categories.reduce((sum, c) => sum + c.count, 0);

  return (
    <main className="min-h-screen p-6">
      <header className="no-print flex items-center justify-between border-b border-neutral-800 pb-3 mb-4">
        <h1 className="text-lg font-bold tracking-tight">BARCODE CONTROL ROOM</h1>
        <div className="flex items-center gap-2">
          {categories.map((c) => (
            <button
              key={c.slug}
              onClick={() => generate(c.slug)}
              disabled={busy !== null}
              className="bg-neutral-100 text-black px-3 py-1 text-xs font-bold uppercase disabled:opacity-40"
            >
              {busy === c.slug ? "Generating…" : `Generate ${c.name} Barcodes`}
            </button>
          ))}
          <button
            onClick={() => window.print()}
            className="border border-neutral-600 px-3 py-1 text-xs font-bold uppercase"
          >
            Print
          </button>
        </div>
      </header>

      {error && <div className="no-print text-red-400 text-xs mb-4">{error}</div>}

      <section className="no-print grid grid-cols-3 gap-4 mb-6 text-xs">
        {categories.map((c) => (
          <div key={c.slug} className="border border-neutral-800 p-3">
            <div className="text-neutral-400">{c.slug}</div>
            <div className="text-base font-semibold">{c.name}</div>
            <div className="text-neutral-400">{c.count} units</div>
          </div>
        ))}
        <div className="border border-neutral-800 p-3">
          <div className="text-neutral-400">STATUS</div>
          <div className="text-base font-semibold">
            {files.length} / {total} generated
          </div>
        </div>
      </section>

      <section className="print-sheet grid grid-cols-4 gap-3">
        {files.map((f) => (
          <figure key={f} className="label-card border border-neutral-800 p-2">
            {/* object-fit: contain keeps the barcode from being scaled and
                distorted — critical for scan quality at print time. */}
            <img
              src={`${API_BASE}/assets/output/${f}`}
              alt={f}
              className="label-img w-full"
              style={{ objectFit: "contain" }}
            />
            <figcaption className="no-print mt-1 flex items-center justify-between text-[11px]">
              <span className="truncate">{f}</span>
              <a
                href={`${API_BASE}/assets/output/${f}`}
                download={f}
                className="text-neutral-400 hover:text-neutral-100"
              >
                download
              </a>
            </figcaption>
          </figure>
        ))}
      </section>
    </main>
  );
}
