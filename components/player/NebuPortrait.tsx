/* The legacy import path is kept for existing callers; all portraits now use Aster. */
import type { ComponentPropsWithoutRef } from "react";
export default function AsterPortrait({ className = "", alt = "", ...props }: Omit<ComponentPropsWithoutRef<"img">, "src">) {
  // eslint-disable-next-line @next/next/no-img-element -- Tiny local pixel sprite; preserve nearest-neighbour rendering.
  return <img {...props} src="/ancient-pulls/wish/astral/aster-pixel.webp" alt={alt} className={`aster-portrait ${className}`} style={{ ...props.style, imageRendering: "pixelated" }} />;
}
