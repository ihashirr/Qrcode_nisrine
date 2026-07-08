import type { FastifyInstance } from "fastify";
import fs from "node:fs/promises";
import path from "node:path";
import { getCategories, getProducts, productsByCategorySlug } from "../config/products";
import { generateAll, generateCategory } from "../scripts/generateBarcodes";
import { MasterAssetError } from "../lib/composite";
import { OUTPUT_DIR } from "../lib/paths";

export async function barcodeRoutes(app: FastifyInstance) {
  app.get("/api/categories", async () => getCategories());

  app.get("/api/products", async () => getProducts());

  app.get("/api/barcodes", async () => {
    await fs.mkdir(OUTPUT_DIR, { recursive: true });
    const files = await fs.readdir(OUTPUT_DIR);
    return files.filter((f) => f.endsWith(".png")).sort();
  });

  app.post("/api/barcodes/generate", async (_req, reply) => {
    try {
      const files = await generateAll();
      reply.code(201);
      return { count: files.length, files: files.map((f) => path.basename(f)) };
    } catch (err) {
      if (err instanceof MasterAssetError) return reply.code(400).send({ error: err.message });
      throw err;
    }
  });

  // Per-category generation — backs the "Generate Mix Sweet" / "Generate
  // Pastries" buttons. The :category param is a slug, e.g. "mix-sweet".
  app.post("/api/barcodes/generate/:category", async (req, reply) => {
    const { category } = req.params as { category: string };
    if (productsByCategorySlug(category).length === 0) {
      return reply.code(404).send({ error: `unknown category "${category}"` });
    }
    try {
      const files = await generateCategory(category);
      reply.code(201);
      return { category, count: files.length, files: files.map((f) => path.basename(f)) };
    } catch (err) {
      if (err instanceof MasterAssetError) return reply.code(400).send({ error: err.message });
      throw err;
    }
  });

  app.get("/assets/output/:filename", async (req, reply) => {
    const { filename } = req.params as { filename: string };
    if (filename.includes("..") || path.isAbsolute(filename)) {
      return reply.code(400).send({ error: "invalid filename" });
    }
    const filePath = path.join(OUTPUT_DIR, filename);
    try {
      const data = await fs.readFile(filePath);
      reply.type("image/png");
      return data;
    } catch {
      return reply.code(404).send({ error: "not found" });
    }
  });
}
