import type {
  MetadataRoute,
} from "next";

export default function manifest():
  MetadataRoute.Manifest {
  return {
    name: "Unknown Pulls",
    short_name: "Unknown Pulls",
    description:
      "Open wishes, collect real Pokemon cards and explore the Unknown Pulls constellation.",
    start_url: "/wishes",
    display: "standalone",
    background_color: "#05071d",
    theme_color: "#0b0c2c",
    icons: [
      {
        src: "/unknown-pulls-icon.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/unknown-pulls-apple-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  };
}
