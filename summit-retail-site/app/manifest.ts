import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Summit Connect",
    short_name: "Summit",
    description: "Your Summit Retail Group updates, policy help, and confirmations in one place.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f6f8f8",
    theme_color: "#087f69",
    lang: "en-US",
    categories: ["business", "productivity"],
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" },
    ],
  };
}
