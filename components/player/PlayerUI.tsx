"use client";

import type {
  CSSProperties,
  ReactNode,
} from "react";

import { getPlayerRarityTheme } from "@/lib/player/rarity";

export function PlayerPageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow: string;
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <p className="text-xs font-black uppercase tracking-[0.22em] text-cyan-100/40">
          {eyebrow}
        </p>

        <h1 className="mt-3 text-4xl font-black tracking-tight text-white sm:text-5xl">
          {title}
        </h1>

        <p className="mt-4 max-w-3xl text-sm font-semibold leading-7 text-white/45 sm:text-base">
          {description}
        </p>
      </div>

      {actions ? (
        <div className="flex flex-wrap gap-3">
          {actions}
        </div>
      ) : null}
    </header>
  );
}

export function PlayerStatCard({
  label,
  value,
  detail,
  accent = "violet",
}: {
  label: string;
  value: string;
  detail: string;
  accent?:
    | "violet"
    | "cyan"
    | "yellow"
    | "pink"
    | "green";
}) {
  const accents = {
    violet:
      "border-violet-200/10 bg-violet-300/[0.045] text-violet-100",
    cyan:
      "border-cyan-200/10 bg-cyan-300/[0.045] text-cyan-100",
    yellow:
      "border-yellow-200/10 bg-yellow-300/[0.045] text-yellow-100",
    pink:
      "border-pink-200/10 bg-pink-300/[0.045] text-pink-100",
    green:
      "border-emerald-200/10 bg-emerald-300/[0.045] text-emerald-100",
  };

  return (
    <article
      className={`rounded-2xl border p-5 ${accents[accent]}`}
    >
      <p className="text-[0.58rem] font-black uppercase tracking-[0.16em] opacity-45">
        {label}
      </p>

      <p className="mt-3 truncate text-2xl font-black text-white">
        {value}
      </p>

      <p className="mt-2 text-xs font-semibold leading-5 text-white/30">
        {detail}
      </p>
    </article>
  );
}

export function PlayerPanel({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <article
      className={`rounded-[2rem] border border-white/10 bg-[#090b27]/82 shadow-[0_24px_80px_rgba(0,0,0,0.2)] backdrop-blur-xl ${className}`}
    >
      {children}
    </article>
  );
}

export function PlayerErrorBanner({
  message,
  onRetry,
}: {
  message: string | null;
  onRetry?: () => void;
}) {
  if (!message) {
    return null;
  }

  return (
    <div className="mt-6 flex flex-col gap-4 rounded-2xl border border-red-200/15 bg-red-400/[0.08] p-4 text-sm font-semibold text-red-100 sm:flex-row sm:items-center sm:justify-between">
      <span>{message}</span>

      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="min-h-10 flex-none rounded-xl border border-red-100/15 bg-red-100/[0.08] px-4 text-xs font-black uppercase tracking-[0.12em] text-red-50 transition hover:bg-red-100/[0.14]"
        >
          Try again
        </button>
      ) : null}
    </div>
  );
}

export function PlayerPrimaryButton({
  children,
  onClick,
  disabled = false,
  type = "button",
  className = "",
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  type?: "button" | "submit";
  className?: string;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`min-h-12 rounded-xl bg-gradient-to-r from-yellow-200 via-cyan-100 to-violet-200 px-5 text-sm font-black text-[#111329] transition hover:-translate-y-0.5 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:translate-y-0 disabled:hover:brightness-100 ${className}`}
    >
      {children}
    </button>
  );
}

export function PlayerSecondaryButton({
  children,
  onClick,
  disabled = false,
  type = "button",
  className = "",
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  type?: "button" | "submit";
  className?: string;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`min-h-12 rounded-xl border border-white/10 bg-white/[0.05] px-5 text-sm font-black text-white/65 transition hover:-translate-y-0.5 hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:translate-y-0 ${className}`}
    >
      {children}
    </button>
  );
}

export function PlayerEmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <PlayerPanel className="mt-6 flex min-h-[28rem] flex-col items-center justify-center px-6 text-center">
      <div className="relative grid h-28 w-28 place-items-center">
        <div className="absolute inset-3 animate-pulse rounded-full bg-cyan-200/10 blur-2xl" />

        <img
          src="/jirachi.png"
          alt=""
          draggable={false}
          className="relative h-24 w-24 object-contain opacity-80 drop-shadow-[0_14px_22px_rgba(0,0,0,0.4)]"
        />
      </div>

      <h2 className="mt-5 text-2xl font-black text-white">
        {title}
      </h2>

      <p className="mt-3 max-w-md text-sm font-semibold leading-7 text-white/38">
        {description}
      </p>

      {action ? <div className="mt-6">{action}</div> : null}
    </PlayerPanel>
  );
}

export function PlayerLoadingCards({
  count = 12,
}: {
  count?: number;
}) {
  return (
    <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          className="overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.025] p-3"
        >
          <div className="aspect-[0.716] animate-pulse rounded-xl bg-white/[0.055]" />
          <div className="mt-4 h-2.5 w-1/2 animate-pulse rounded bg-white/[0.06]" />
          <div className="mt-3 h-4 w-4/5 animate-pulse rounded bg-white/[0.07]" />
          <div className="mt-2 h-2.5 w-2/3 animate-pulse rounded bg-white/[0.045]" />
        </div>
      ))}
    </div>
  );
}

export function RarityPill({
  rarity,
}: {
  rarity: string;
}) {
  const theme = getPlayerRarityTheme(rarity);

  const style = {
    color: theme.primary,
    borderColor: theme.background,
    background: theme.background,
    boxShadow: `0 0 18px ${theme.background}`,
  } as CSSProperties;

  return (
    <span
      className="inline-flex min-h-8 items-center rounded-full border px-3 text-[0.6rem] font-black uppercase tracking-[0.14em]"
      style={style}
    >
      {rarity}
    </span>
  );
}

export function CardArtwork({
  name,
  imageUrl,
  rarity,
  className = "",
}: {
  name: string;
  imageUrl: string | null;
  rarity: string;
  className?: string;
}) {
  const theme = getPlayerRarityTheme(rarity);

  return (
    <div
      className={`relative overflow-hidden bg-[#050713] ${className}`}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-25"
        style={{
          background: `radial-gradient(circle at 50% 38%, ${theme.glow}, transparent 60%)`,
        }}
      />

      {imageUrl ? (
        <img
          src={imageUrl}
          alt={name}
          loading="lazy"
          draggable={false}
          className="relative z-10 h-full w-full object-contain"
        />
      ) : (
        <div className="relative z-10 flex h-full w-full flex-col items-center justify-center gap-4 p-5 text-center">
          <span
            className="text-7xl"
            style={{
              color: theme.primary,
              filter: `drop-shadow(0 0 22px ${theme.glow})`,
            }}
          >
            *
          </span>

          <strong className="text-sm text-white/80">
            {name}
          </strong>
        </div>
      )}
    </div>
  );
}
