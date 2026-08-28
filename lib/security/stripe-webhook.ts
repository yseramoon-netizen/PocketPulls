import { createHmac, timingSafeEqual } from "node:crypto";

export const STRIPE_SIGNATURE_TOLERANCE_SECONDS = 300;

export function parseStripeSignature(header: string) {
  const parts = header.split(",").map((part) => part.trim());
  const timestampText = parts.find((part) => part.startsWith("t="))?.slice(2);
  const signatures = parts
    .filter((part) => part.startsWith("v1="))
    .map((part) => part.slice(3))
    .filter(Boolean);

  return {
    timestamp: timestampText ? Number(timestampText) : Number.NaN,
    signatures,
  };
}

export function safeHexEqual(leftHex: string, rightHex: string): boolean {
  try {
    const left = Buffer.from(leftHex, "hex");
    const right = Buffer.from(rightHex, "hex");
    return left.length > 0 && left.length === right.length && timingSafeEqual(left, right);
  } catch {
    return false;
  }
}

export function signStripePayload(
  rawBody: string,
  timestamp: number,
  secret: string,
): string {
  return createHmac("sha256", secret)
    .update(`${timestamp}.${rawBody}`, "utf8")
    .digest("hex");
}

export function verifyStripeSignature(
  rawBody: string,
  signatureHeader: string,
  secret: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): void {
  const { timestamp, signatures } = parseStripeSignature(signatureHeader);

  if (!Number.isFinite(timestamp) || signatures.length === 0) {
    throw new Error("Stripe webhook signature is malformed.");
  }

  if (
    Math.abs(nowSeconds - timestamp) >
    STRIPE_SIGNATURE_TOLERANCE_SECONDS
  ) {
    throw new Error("Stripe webhook signature is outside the allowed time window.");
  }

  const expected = signStripePayload(rawBody, timestamp, secret);

  if (!signatures.some((signature) => safeHexEqual(signature, expected))) {
    throw new Error("Stripe webhook signature verification failed.");
  }
}
