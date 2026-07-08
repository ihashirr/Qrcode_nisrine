import type { FastifyInstance } from "fastify";
import fs from "node:fs/promises";
import path from "node:path";
import { CATEGORIES } from "../config/categories";
import { generateAll } from "../scripts/generateBarcodes";
import { OUTPUT_DIR } from "../lib/paths";

export async function barcodeRoutes(app: FastifyInstance) {
  app.get("/api/categories", async () => CATEGORIES);

  app.get("/api/barcodes", async () => {
    await fs.mkdir(OUTPUT_DIR, { recursive: true });
    const files = await fs.readdir(OUTPUT_DIR);
    return files.filter((f) => f.endsWith(".png"));
  });

  app.post("/api/barcodes/generate", async (_req, reply) => {
    const files = await generateAll();
    reply.code(201);
    return { count: files.length, files: files.map((f) => path.basename(f)) };
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
