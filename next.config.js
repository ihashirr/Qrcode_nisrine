/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // sharp ships native binaries — keep it external so Next never tries to
  // bundle it into the server output.
  experimental: {
    serverComponentsExternalPackages: ["sharp"],
    // Force the data source + logo into the traced output for the routes
    // that read them, so generation works during the (Vercel) build.
    outputFileTracingIncludes: {
      "/api/sticker/[sku]": ["./products.json", "./assets/master-logo.png"],
      "/api/catalog": ["./products.json"],
    },
  },
};

module.exports = nextConfig;
