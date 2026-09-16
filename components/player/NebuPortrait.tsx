"use client";
import type { ComponentPropsWithoutRef } from "react";
import AstraCompanion from "./astral/AstraCompanion";
/** Compatibility import for existing account/tutorial components. */
export default function AstraPortrait({className="",alt="Astra"}:Omit<ComponentPropsWithoutRef<"img">,"src">) {
  return <AstraCompanion className={className} label={alt ? "Astra, your star companion" : ""} still/>;
}
