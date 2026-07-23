import type { MetadataRoute } from "next";
import { getBrandAssetVersion } from "@/lib/app-version";

/**
 * Manifest PWA com ícones versionados (?v=) para forçar
 * o browser a buscar a marca nova após cada deploy/brand bump.
 */
export default function manifest(): MetadataRoute.Manifest {
  const v = getBrandAssetVersion();
  const icon = (path: string) => `${path}?v=${encodeURIComponent(v)}`;

  return {
    name: "Melza",
    short_name: "Melza",
    description: "Finanças pessoais e compartilhadas por workspace",
    start_url: "/dashboard",
    scope: "/",
    id: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#F2F2F7",
    theme_color: "#F2F2F7",
    lang: "pt-BR",
    categories: ["finance", "productivity"],
    icons: [
      {
        src: icon("/icons/icon-192.png"),
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: icon("/icons/icon-512.png"),
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: icon("/icons/icon-512-maskable.png"),
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
