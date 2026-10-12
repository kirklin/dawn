import type { MetadataRoute } from "next";
import { defaultLocale } from "~/lib/i18n/navigation";
import messages from "~/locales/zh.json";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: messages.App.brand,
    short_name: messages.App.name,
    description: messages.App.description,
    lang: defaultLocale,
    start_url: "/",
    display: "standalone",
    background_color: "#000000",
    theme_color: "#000000",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
