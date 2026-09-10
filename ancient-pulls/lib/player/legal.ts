export const LEGAL_LAST_UPDATED = "1 September 2026";

function publicValue(value: string | undefined): string {
  return value?.trim() || "";
}

export const BUSINESS_TRADING_NAME =
  publicValue(process.env.NEXT_PUBLIC_BUSINESS_TRADING_NAME) || "Ancient Pulls";

export const BUSINESS_LEGAL_NAME = publicValue(
  process.env.NEXT_PUBLIC_BUSINESS_LEGAL_NAME,
);

export const BUSINESS_NAME = BUSINESS_LEGAL_NAME || BUSINESS_TRADING_NAME;

export const SUPPORT_EMAIL = publicValue(process.env.NEXT_PUBLIC_SUPPORT_EMAIL);

export const PRIVACY_EMAIL =
  publicValue(process.env.NEXT_PUBLIC_PRIVACY_EMAIL) || SUPPORT_EMAIL;

export const BUSINESS_ADDRESS = publicValue(
  process.env.NEXT_PUBLIC_BUSINESS_ADDRESS,
);

export const BUSINESS_PHONE = publicValue(process.env.NEXT_PUBLIC_BUSINESS_PHONE);

export const COMPANY_NUMBER = publicValue(process.env.NEXT_PUBLIC_COMPANY_NUMBER);

export const VAT_NUMBER = publicValue(process.env.NEXT_PUBLIC_VAT_NUMBER);

export const BUSINESS_DETAILS_COMPLETE = Boolean(
  BUSINESS_LEGAL_NAME && SUPPORT_EMAIL && PRIVACY_EMAIL && BUSINESS_ADDRESS,
);

export function missingBusinessDetails(): string[] {
  const missing: string[] = [];

  if (!BUSINESS_LEGAL_NAME) missing.push("legal operator name");
  if (!SUPPORT_EMAIL) missing.push("customer-service email");
  if (!PRIVACY_EMAIL) missing.push("privacy contact email");
  if (!BUSINESS_ADDRESS) missing.push("geographic business address");

  return missing;
}

export function supportLabel(): string {
  return SUPPORT_EMAIL || "Customer-service email not configured";
}

export function privacyLabel(): string {
  return PRIVACY_EMAIL || "Privacy email not configured";
}
