import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "app.dodol.recipes",
  appName: "Dodol",
  webDir: "out",
  server: {
    // Point the WebView directly at the live Vercel deployment.
    // This avoids static-export routing limitations and means any Vercel
    // deploy is instantly live in the app — no rebuild or App Store update needed.
    // The app already requires internet for Claude, so this is the right trade-off.
    url: "https://recipe-keeper-eta.vercel.app",
    cleartext: false,
  },
};

export default config;
