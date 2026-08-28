export const LEGAL_LAST_UPDATED = "27 August 2026";

export const BUSINESS_NAME =
  process.env.NEXT_PUBLIC_BUSINESS_LEGAL_NAME?.trim() || "ancientpulls";

export const SUPPORT_EMAIL =
  process.env.NEXT_PUBLIC_SUPPORT_EMAIL?.trim() || "";

export const BUSINESS_ADDRESS =
  process.env.NEXT_PUBLIC_BUSINESS_ADDRESS?.trim() || "";

export function supportLabel(): string {
  return SUPPORT_EMAIL || "Use Support inside your Ancient Pulls account";
}
