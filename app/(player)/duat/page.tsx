import type { Metadata } from "next";

import EndlessDuatPortal from "@/components/player/duat/EndlessDuatPortal";
import "./duat.css";

export const metadata: Metadata = {
  title: "Nebu Sandfall | Ancient Pulls",
  description: "Dig forever with Nebu, uncover buried artifacts and earn free wishes.",
};

export default function EndlessDuatPage() {
  return <EndlessDuatPortal />;
}
