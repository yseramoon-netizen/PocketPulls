"use client";

import type {
  CSSProperties,
  ReactNode,
} from "react";

import UnownText from "@/components/player/UnownText";
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
    <header className="relative overflow-hidden rounded-[2rem] border border-violet-200/15 bg-[#090b27]/76 p-5 shadow-[0_24px_90px_rgba(0,0,0,0.24)] backdrop-blur-xl sm:p-7">
      <div className="pointer-events-none absolute inset-x-8 top-0 h-[2px] bg-gradient-to-r from-violet-300/20 via-cyan-200/55 to-yellow-200/25" />
      <div className="pointer-events-none absolute -right-20 -top-20 h-52 w-52 rounded-full bg-cyan-300/[0.1] blur-[80px]" />
      <div className="pointer-events-none absolute -bottom-24 left-12 h-52 w-52 rounded-full bg-violet-400/[0.11] blur-[80px]" />
      <div className="pointer-events-none absolute left-[35%] top-[-8rem] h-44 w-44 rounded-full bg-pink-300/[0.035] blur-[76px]" />
      <div className="pointer-events-none absolute bottom-[-8rem] right-[26%] h-40 w-40 rounded-full bg-cyan-300/[0.035] blur-[72px]" />

      <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-cyan-100/42">
            {eyebrow}
          </p>

          <div className="mt-4 max-w-full overflow-hidden">
            <UnownText
              text={title}
              size="clamp(2.15rem, 5vw, 4.15rem)"
              tone="holo"
            />
          </div>

          <p className="mt-5 max-w-3xl text-sm font-semibold leading-7 text-white/48 sm:text-base">
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
      className={`relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br ${accents[accent]} to-[#090b27]/84 p-5 shadow-[inset_0_0_0_1px_rgba(103,232,249,0.035),0_18px_50px_rgba(0,0,0,0.16)] backdrop-blur-xl`}
    >
      <div className="pointer-events-none absolute inset-x-4 top-0 h-px bg-gradient-to-r from-violet-300/18 via-cyan-200/42 to-yellow-200/18" />

      <p className="relative text-[0.58rem] font-black uppercase tracking-[0.16em] opacity-48">
        {label}
      </p>

      <p className="relative mt-3 truncate text-2xl font-black text-white">
        {value}
      </p>

      <p className="relative mt-2 text-xs font-semibold leading-5 text-white/32">
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
      className={`relative overflow-hidden rounded-[2rem] border border-white/10 bg-[#090b27]/82 shadow-[inset_0_0_0_1px_rgba(103,232,249,0.035),0_24px_80px_rgba(0,0,0,0.22)] backdrop-blur-xl ${className}`}
    >
      <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-violet-300/18 via-cyan-200/42 to-yellow-200/18" />
      <div className="pointer-events-none absolute -right-20 -top-20 h-44 w-44 rounded-full bg-violet-400/[0.07] blur-[75px]" />
      <div className="pointer-events-none absolute -bottom-20 left-12 h-44 w-44 rounded-full bg-cyan-300/[0.06] blur-[75px]" />
      <div className="pointer-events-none absolute -left-20 top-[35%] h-36 w-36 rounded-full bg-pink-300/[0.025] blur-[65px]" />
      <div className="pointer-events-none absolute -bottom-20 right-20 h-36 w-36 rounded-full bg-cyan-300/[0.025] blur-[65px]" />

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
    <PlayerPanel className="mt-6 flex min-h-[28rem] flex-col items-center justify-center px-6 text-center">
      <div className="relative grid h-28 w-28 place-items-center">
        <div className="absolute inset-3 animate-pulse rounded-full bg-cyan-200/10 blur-2xl" />

        <img
          src="/jirachi.png"
          alt=""
          draggable={false}
          className="relative h-24 w-24 object-contain opacity-82 drop-shadow-[0_14px_22px_rgba(0,0,0,0.4)]"
        />
      </div>

      <div className="mt-5 w-full max-w-xl px-2 text-center">
        {title.length <= 14 ? (
          <div className="mx-auto max-w-full overflow-hidden">
            <UnownText
              text={title}
              size="clamp(1.35rem, 3.6vw, 2.15rem)"
              tone="ancient"
              centred
            />
          </div>
        ) : (
          <h3 className="text-balance text-xl font-black leading-tight tracking-tight text-white sm:text-2xl">
            {title}
          </h3>
        )}
      </div>

      <p className="mt-4 max-w-md text-sm font-semibold leading-7 text-white/40">
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
