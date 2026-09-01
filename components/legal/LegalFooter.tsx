"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  BUSINESS_ADDRESS,
  BUSINESS_LEGAL_NAME,
  BUSINESS_TRADING_NAME,
  SUPPORT_EMAIL,
} from "@/lib/player/legal";

const LINKS = [
  ["/terms", "Terms"],
  ["/returns", "Refunds & Returns"],
  ["/shipping-policy", "Shipping"],
  ["/privacy", "Privacy"],
  ["/cookies", "Cookies"],
  ["/contact", "Business & Contact"],
] as const;

export default function LegalFooter() {
  const pathname = usePathname();

  if (pathname.startsWith("/admin")) return null;

  return (
    <footer className="relative z-10 border-t border-white/[0.07] bg-[#03040d] px-4 py-6 text-white">
      <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-black text-white/72">{BUSINESS_TRADING_NAME}</p>
          <p className="mt-1 max-w-2xl whitespace-pre-line text-[0.68rem] font-semibold leading-5 text-white/30">
            {BUSINESS_LEGAL_NAME ? `Operated by ${BUSINESS_LEGAL_NAME}.` : "Pre-launch legal operator details pending."}
            {BUSINESS_ADDRESS ? ` ${BUSINESS_ADDRESS}` : ""}
            {SUPPORT_EMAIL ? ` ${SUPPORT_EMAIL}` : ""}
          </p>
        </div>
        <nav aria-label="Legal information" className="flex flex-wrap gap-x-4 gap-y-2 text-[0.68rem] font-black text-white/42">
          {LINKS.map(([href, label]) => (
            <Link key={href} href={href} className="transition hover:text-cyan-100">
              {label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
