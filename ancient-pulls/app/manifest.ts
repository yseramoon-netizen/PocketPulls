import type {
  MetadataRoute,
} from "next";

export default function manifest():
  MetadataRoute.Manifest {
  return {
    name: "Ancient Pulls",
    short_name: "Ancient Pulls",
    description:
      "Make wishes, build your binder and explore your constellation.",
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
