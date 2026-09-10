"use client";

import type { ReactNode } from "react";

export default function AuthField({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 flex items-center justify-between gap-4 text-[0.65rem] font-black uppercase tracking-[0.14em] text-white/42">
        <span>{label}</span>
        {hint ? (
          <span className="normal-case tracking-normal text-white/24">
            {hint}
          </span>
        ) : null}
      </span>
      {children}
    </label>
  );
}

export const AUTH_INPUT_CLASS =
  "min-h-13 w-full rounded-xl border border-white/10 bg-black/20 px-4 text-sm font-bold text-white outline-none transition placeholder:text-white/20 focus:border-cyan-200/35 focus:ring-2 focus:ring-cyan-200/10 disabled:cursor-not-allowed disabled:opacity-50";
