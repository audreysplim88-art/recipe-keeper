import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  turbopack: {
    // Explicitly set the project root so Turbopack doesn't get confused
    // by the package-lock.json in the parent home directory.
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
