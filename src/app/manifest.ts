import type { MetadataRoute } from "next";

// Lets the app be added to a phone's home screen (CLAUDE.md §5: PWA).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Facade Report",
    short_name: "Facade Report",
    description: "Draft and check NYC FISP facade inspection reports",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#1d4ed8",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
