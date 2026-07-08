"use client";

import { useCallback, useEffect, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:4000";

interface Category {
  name: string;
  code: string;
  count: number;
}

export default function ControlRoom() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [files, setFiles] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
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

  const generate = async () => {
    setBusy(true);
    setError(null);
    try {
      await fetch(`${API_BASE}/api/barcodes/generate`, { method: "POST" });
      await refresh();
    } catch {
      setError("Generation failed. Check backend logs.");
    } finally {
      setBusy(false);
    }
  };

  const expected = categories.reduce((sum, c) => sum + c.count, 0);

  return (
    <main className="min-h-screen p-6">
      <header className="flex items-center justify-between border-b border-neutral-800 pb-3 mb-4">
        <h1 className="text-lg font-bold tracking-tight">BARCODE CONTROL ROOM</h1>
        <button
          onClick={generate}
          disabled={busy}
          className="bg-neutral-100 text-black px-3 py-1 text-xs font-bold uppercase disabled:opacity-40"
        >
          {busy ? "Generating…" : "Generate All"}
        </button>
      </header>

      {error && <div className="text-red-400 text-xs mb-4">{error}</div>}

      <section className="grid grid-cols-3 gap-4 mb-6 text-xs">
        {categories.map((c) => (
          <div key={c.code} className="border border-neutral-800 p-3">
            <div className="text-neutral-400">{c.code}</div>
            <div className="text-base font-semibold">{c.name}</div>
            <div className="text-neutral-400">{c.count} units</div>
          </div>
        ))}
        <div className="border border-neutral-800 p-3">
          <div className="text-neutral-400">STATUS</div>
          <div className="text-base font-semibold">
            {files.length} / {expected} generated
          </div>
        </div>
      </section>

      <section className="grid grid-cols-4 gap-3">
        {files.map((f) => (
          <a
            key={f}
            href={`${API_BASE}/assets/output/${f}`}
            target="_blank"
            rel="noreferrer"
            className="border border-neutral-800 p-2 text-[11px] truncate hover:border-neutral-500"
          >
            {f}
          </a>
        ))}
      </section>
    </main>
  );
}
