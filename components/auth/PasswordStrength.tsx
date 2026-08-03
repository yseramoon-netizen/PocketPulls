"use client";

import { getPasswordStrength } from "@/lib/auth/helpers";

export default function PasswordStrength({
  password,
}: {
  password: string;
}) {
  const strength = getPasswordStrength(password);

  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.025] p-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[0.6rem] font-black uppercase tracking-[0.12em] text-white/28">
          Password strength
        </span>
        <span className="text-xs font-black text-cyan-100/60">
          {strength.label}
        </span>
      </div>

      <div className="mt-3 grid grid-cols-4 gap-1.5">
        {Array.from({ length: 4 }).map((_, index) => (
          <span
            key={index}
            className={`h-1.5 rounded-full transition ${
              index < strength.score
                ? "bg-gradient-to-r from-cyan-300 via-violet-300 to-yellow-200"
                : "bg-white/[0.07]"
            }`}
          />
        ))}
      </div>

      <div className="mt-3 grid gap-1 text-[0.65rem] font-semibold text-white/30 sm:grid-cols-2">
        <Rule ok={strength.checks.length}>10+ characters</Rule>
        <Rule ok={strength.checks.mixedCase}>Upper and lowercase</Rule>
        <Rule ok={strength.checks.number}>At least one number</Rule>
        <Rule ok={strength.checks.symbol}>At least one symbol</Rule>
      </div>
    </div>
  );
}

function Rule({
  ok,
  children,
}: {
  ok: boolean;
  children: React.ReactNode;
}) {
  return (
    <span className={ok ? "text-emerald-100/60" : ""}>
      {ok ? "✓" : "·"} {children}
    </span>
  );
}
