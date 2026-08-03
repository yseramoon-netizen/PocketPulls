"use client";

type WalletAccent = "emerald" | "blue" | "purple" | "gold";

export type WalletProps = {
  balance: number;
  currency?: string;
  label?: string;
  accent?: WalletAccent;
};

const accentStyles: Record<
  WalletAccent,
  {
    container: string;
    glow: string;
    badge: string;
    amount: string;
  }
> = {
  emerald: {
    container:
      "from-emerald-400/20 via-emerald-900/20 to-emerald-950/40 border-emerald-200/30",
    glow: "shadow-[0_0_60px_rgba(52,211,153,0.3)]",
    badge: "bg-emerald-400/20 text-emerald-100 border-emerald-200/30",
    amount: "text-emerald-100",
  },

  blue: {
    container:
      "from-sky-400/20 via-blue-900/20 to-slate-950/40 border-sky-200/30",
    glow: "shadow-[0_0_60px_rgba(56,189,248,0.3)]",
    badge: "bg-sky-400/20 text-sky-100 border-sky-200/30",
    amount: "text-sky-100",
  },

  purple: {
    container:
      "from-purple-400/20 via-purple-900/20 to-slate-950/40 border-purple-200/30",
    glow: "shadow-[0_0_60px_rgba(192,132,252,0.3)]",
    badge: "bg-purple-400/20 text-purple-100 border-purple-200/30",
    amount: "text-purple-100",
  },

  gold: {
    container:
      "from-yellow-400/20 via-amber-900/20 to-slate-950/40 border-yellow-200/30",
    glow: "shadow-[0_0_60px_rgba(250,204,21,0.3)]",
    badge: "bg-yellow-400/20 text-yellow-100 border-yellow-200/30",
    amount: "text-yellow-100",
  },
};

export default function Wallet({
  balance,
  currency = "£",
  label = "Wallet",
  accent = "emerald",
}: WalletProps) {
  const styles = accentStyles[accent];

  const safeBalance = Number.isFinite(Number(balance))
    ? Number(balance)
    : 0;

  return (
    <section
      className={`
        relative
        overflow-hidden
        rounded-[2rem]
        border
        bg-gradient-to-br
        p-6
        backdrop-blur-3xl
        ${styles.container}
        ${styles.glow}
      `}
    >
      <div
        className="
          pointer-events-none
          absolute
          inset-0
          bg-gradient-to-br
          from-white/15
          via-transparent
          to-transparent
        "
      />

      <div className="relative z-10">
        <div
          className={`
            inline-flex
            items-center
            gap-2
            rounded-full
            border
            px-4
            py-2
            text-sm
            font-black
            ${styles.badge}
          `}
        >
          <span aria-hidden="true">💎</span>
          <span>{label}</span>
        </div>

        <p
          className={`
            mt-5
            text-5xl
            font-black
            tracking-tight
            ${styles.amount}
          `}
        >
          {currency}
          {safeBalance.toFixed(2)}
        </p>
      </div>
    </section>
  );
}