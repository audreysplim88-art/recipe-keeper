import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Dodol",
    short_name: "Dodol",
    description: "Capture recipes the way you cook — with all the tips, tricks and secrets",
    start_url: "/",
    display: "standalone",
    background_color: "#fef3c7",
    theme_color: "#92400e",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
