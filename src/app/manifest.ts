import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name:             "Portal CRM",
    short_name:       "CRM",
    description:      "Portal de leads para consultores",
    start_url:        "/consultor",
    display:          "standalone",
    background_color: "#0f1117",
    theme_color:      "#0f1117",
    orientation:      "portrait",
    icons: [
      { src: "/icon.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
