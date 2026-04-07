import type { NextConfig } from "next";
import path from "path";

const securityHeaders = [
  // Prevent MIME-type sniffing
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Disallow embedding in iframes (clickjacking protection)
  { key: "X-Frame-Options", value: "DENY" },
  // Control referrer information sent with requests
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Restrict access to device features not needed by the app
  // (camera/mic are used, so left unrestricted here — iOS handles permissions natively)
  { key: "Permissions-Policy", value: "geolocation=()" },
];

const nextConfig: NextConfig = {
  turbopack: {
    // Explicitly set the project root so Turbopack doesn't get confused
    // by the package-lock.json in the parent home directory.
    root: path.resolve(__dirname),
  },
  async headers() {
    return [
      {
        // Apply security headers to all routes
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
