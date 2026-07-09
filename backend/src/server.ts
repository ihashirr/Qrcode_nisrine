import Fastify from "fastify";
import cors from "@fastify/cors";
import { barcodeRoutes } from "./routes/barcodes";

const app = Fastify({ logger: true });

async function main() {
  await app.register(cors, { origin: true });
  await app.register(barcodeRoutes);

  const port = Number(process.env.PORT ?? 4000);
  await app.listen({ port, host: "0.0.0.0" });
}

main().catch((err) => {
  app.log.error(err);
  process.exit(1);
});
