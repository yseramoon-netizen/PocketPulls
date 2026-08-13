import type { Metadata } from "next";

import EndlessDuatPortal from "@/components/player/duat/EndlessDuatPortal";
import "./duat.css";

export const metadata: Metadata = {
  title: "Nebu and the Endless Duat | Ancient Pulls",
  description: "An infinite Ancient Pulls expedition with Nebu, relics, kingdoms and free-wish forging.",
};

export default function EndlessDuatPage() {
  return <EndlessDuatPortal />;
}
