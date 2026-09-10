import type { CSSProperties } from "react";
/** Compatibility adapter for the original decorative headings. */
export default function AstralText({text, translation, size = "2.75rem", className = "", centred = false, tone = "ancient"}: {
 text: string; translation?: string; size?: string; className?: string; centred?: boolean;
 tone?: "ancient" | "holo" | "moon" | "muted"; wrap?: boolean; showTranslation?: boolean;
}) {
 return <span className={`astral-type ${className}`} data-tone={tone} style={{ "--astral-type-size": size, textAlign: centred ? "center" : undefined } as CSSProperties}>{translation || text}</span>;
}
