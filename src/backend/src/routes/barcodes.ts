import type { FastifyInstance, FastifyReply } from "fastify";
import fs from "node:fs/promises";
import path from "node:path";
import { getCategories, getProducts, productsByCategorySlug } from "../config/products";
import { generateAll, generateCategory } from "../scripts/generateBarcodes";
import { MasterAssetError } from "../lib/composite";
import { googleVerificationUrl, verificationUrl } from "../lib/verify";
import { OUTPUT_DIR } from "../lib/paths";

/** Audit failures (thrown on config load) become a 409 with the exact
 * conflict message; missing master assets a 400; anything else bubbles up. */
function sendKnownError(reply: FastifyReply, err: unknown): boolean {
  if (err instanceof Error && err.message.startsWith("Conflict detected")) {
    reply.code(409).send({ error: err.message });
    return true;
  }
  if (err instanceof MasterAssetError) {
    reply.code(400).send({ error: err.message });
    return true;
  }
  return false;
}

export async function barcodeRoutes(app: FastifyInstance) {
  app.get("/api/categories", async (_req, reply) => {
    try {
      return getCategories();
    } catch (err) {
      if (sendKnownError(reply, err)) return;
      throw err;
    }
  });

  app.get("/api/products", async (_req, reply) => {
    try {
      return getProducts().map((p) => ({
        ...p,
        verifyUrl: verificationUrl(p.gtin),
        verifyUrlGoogle: googleVerificationUrl(p.gtin),
      }));
    } catch (err) {
      if (sendKnownError(reply, err)) return;
      throw err;
    }
  });

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
      if (sendKnownError(reply, err)) return;
      throw err;
    }
  });

  // Per-category generation — backs the "Generate Mix Sweet" / "Generate
  // Pastries" buttons. The :category param is a slug, e.g. "mix-sweet".
  app.post("/api/barcodes/generate/:category", async (req, reply) => {
    const { category } = req.params as { category: string };
    try {
      if (productsByCategorySlug(category).length === 0) {
        return reply.code(404).send({ error: `unknown category "${category}"` });
      }
      const files = await generateCategory(category);
      reply.code(201);
      return { category, count: files.length, files: files.map((f) => path.basename(f)) };
    } catch (err) {
      if (sendKnownError(reply, err)) return;
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
