"use client";

import type {
  CSSProperties,
  ReactNode,
} from "react";

import AsterismSigil from "@/components/player/AsterismSigil";
import NebuPortrait from "@/components/player/NebuPortrait";
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
    <header data-player-page-header className="relative overflow-hidden rounded-2xl border border-white/[0.09] bg-[#080b20]/88 p-5 shadow-[0_18px_60px_rgba(0,0,0,0.22)] backdrop-blur-xl sm:p-6">
      <div data-player-surface-line className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-cyan-200/42 to-transparent" />
      <div data-cosmic-page-sigil aria-hidden="true">
        <AsterismSigil seed={`${eyebrow}:${title}`} points={7} />
      </div>

      <div className="relative flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <p className="text-[0.65rem] font-black uppercase tracking-[0.18em] text-cyan-100/46">
            {eyebrow}
          </p>

          <h1 className="mt-2 text-3xl font-black tracking-[-0.04em] text-white sm:text-4xl">
            {title}
          </h1>

          <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-white/45">
            {description}
          </p>
        </div>

        {actions ? (
          <div className="flex flex-wrap gap-3">
            {actions}
          </div>
        ) : null}
      </div>
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
      "from-violet-300/[0.11] via-violet-300/[0.035] text-violet-100",
    cyan:
      "from-cyan-300/[0.11] via-cyan-300/[0.035] text-cyan-100",
    yellow:
      "from-amber-200/[0.12] via-amber-200/[0.04] text-amber-100",
    pink:
      "from-pink-300/[0.11] via-pink-300/[0.035] text-pink-100",
    green:
      "from-emerald-300/[0.11] via-emerald-300/[0.035] text-emerald-100",
  };

  return (
    <article
      data-player-stat-card
      className={`relative overflow-hidden rounded-xl border border-white/[0.09] bg-gradient-to-br ${accents[accent]} to-[#080b20]/88 p-4 shadow-[0_14px_40px_rgba(0,0,0,0.14)]`}
    >
      <p className="relative text-[0.58rem] font-black uppercase tracking-[0.16em] opacity-48">
        {label}
      </p>

      <p className="relative mt-2 truncate text-2xl font-black text-white">
        {value}
      </p>

      <p className="relative mt-1.5 text-xs font-semibold leading-5 text-white/34">
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
      data-player-panel
      className={`relative overflow-hidden rounded-2xl border border-white/[0.09] bg-[#080b20]/88 shadow-[0_18px_60px_rgba(0,0,0,0.2)] backdrop-blur-xl ${className}`}
    >
      <div data-player-surface-line className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-cyan-200/28 to-transparent" />

      <div className="relative h-full">
        {children}
      </div>
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
    <div className="mt-6 flex flex-col gap-4 rounded-2xl border border-red-200/15 bg-red-400/[0.08] p-4 text-sm font-semibold text-red-100 shadow-[inset_0_0_0_1px_rgba(244,202,114,0.04)] sm:flex-row sm:items-center sm:justify-between">
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
      data-player-primary-button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`min-h-12 rounded-xl border border-white/15 bg-gradient-to-r from-cyan-100 via-yellow-100 to-violet-200 px-5 text-sm font-black text-[#111329] shadow-[0_0_28px_rgba(103,232,249,0.08)] transition hover:-translate-y-0.5 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:translate-y-0 disabled:hover:brightness-100 ${className}`}
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
      className={`min-h-12 rounded-xl border border-white/10 bg-white/[0.05] px-5 text-sm font-black text-white/65 shadow-[inset_0_0_0_1px_rgba(103,232,249,0.025)] transition hover:-translate-y-0.5 hover:border-violet-200/20 hover:bg-white/[0.08] hover:text-white disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:translate-y-0 ${className}`}
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
    <PlayerPanel className="mt-6 flex min-h-[18rem] flex-col items-center justify-center px-6 py-9 text-center">
      <div className="relative mx-auto flex h-20 w-20 flex-none items-center justify-center">
        <div className="absolute inset-3 rounded-full bg-cyan-200/10 blur-2xl" />

        <NebuPortrait
          alt=""
          draggable={false}
          className="relative z-10 block h-16 w-16 object-contain opacity-100"
        />
      </div>

      <h2 className="mt-4 text-xl font-black tracking-tight text-white sm:text-2xl">
        {title}
      </h2>

      <p className="mx-auto mt-3 max-w-md text-sm font-semibold leading-6 text-white/42">
        {description}
      </p>

      {action ? <div className="mt-6 flex justify-center">{action}</div> : null}
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
          className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#090b27]/64 p-3"
        >
          <div className="aspect-[0.716] animate-pulse rounded-xl bg-white/[0.055]" />
          <div className="mt-4 h-2.5 w-1/2 animate-pulse rounded bg-violet-100/[0.06]" />
          <div className="mt-3 h-4 w-4/5 animate-pulse rounded bg-white/[0.07]" />
          <div className="mt-2 h-2.5 w-2/3 animate-pulse rounded bg-cyan-100/[0.045]" />
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

      <div className="pointer-events-none absolute inset-1 rounded-[inherit] border border-white/[0.06]" />

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
            className="h-12 w-12 rounded-full border border-white/10"
            style={{
              background: theme.background,
              boxShadow: `0 0 26px ${theme.glow}`,
            }}
          />

          <strong className="text-sm text-white/80">
            {name}
          </strong>
        </div>
      )}
    </div>
  );
}
