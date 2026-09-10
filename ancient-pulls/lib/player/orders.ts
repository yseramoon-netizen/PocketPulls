import { BUSINESS_DETAILS_COMPLETE } from "@/lib/player/legal";

export const ORDERS_NOT_READY_MESSAGE =
  "Orders are not open yet. No payment can be taken.";

export function isOrderConfirmationConfigured(): boolean {
  return Boolean(
    process.env.RESEND_API_KEY?.trim() &&
      process.env.ANCIENT_PULLS_ORDER_EMAIL_FROM?.trim(),
  );
}

export function areOrdersOpen(): boolean {
  return (
    process.env.ANCIENT_PULLS_ORDERS_OPEN?.trim().toLowerCase() === "true" &&
    BUSINESS_DETAILS_COMPLETE &&
    isOrderConfirmationConfigured()
  );
}
