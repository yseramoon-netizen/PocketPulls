import type {
  MetadataRoute,
} from "next";

export default function manifest():
  MetadataRoute.Manifest {
  return {
    name: "ancientpulls",
    short_name: "ancientpulls",
    description:
      "Open wishes, collect real Pokemon cards and explore the ancientpulls constellation.",
    start_url: "/wishes",
    display: "standalone",
    background_color: "#05071d",
    theme_color: "#0b0c2c",
    icons: [
      {
        src: "/ancient-pulls/celestial-cat.png",
        sizes: "1254x1254",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
