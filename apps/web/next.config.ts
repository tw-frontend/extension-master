import path from "node:path";

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // The registry snapshot lives in a sibling workspace package — pin tracing here
  // so Next never infers a wrong monorepo root.
  outputFileTracingRoot: path.join(import.meta.dirname),
  transpilePackages: ["@extensions-hub/extension-registry"],
};

export default nextConfig;
