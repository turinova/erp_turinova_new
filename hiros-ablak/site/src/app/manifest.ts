import type { MetadataRoute } from "next"
import { COMPANY } from "@/lib/company"

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: COMPANY.brand,
    short_name: COMPANY.brand,
    description:
      "Lapszabászat, élzárás és bútorlap Kecskeméten. Barkácsáruház, online árajánlat, asztalos partnerprogram.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#971d25",
    lang: "hu",
    icons: [
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
  }
}
