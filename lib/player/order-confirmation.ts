import {
  BUSINESS_ADDRESS,
  BUSINESS_LEGAL_NAME,
  BUSINESS_PHONE,
  BUSINESS_TRADING_NAME,
  COMPANY_NUMBER,
  LEGAL_LAST_UPDATED,
  SUPPORT_EMAIL,
  VAT_NUMBER,
} from "@/lib/player/legal";

type ConfirmationOrder = {
  id: string;
  packageId: string;
  wishes: number;
  amountPence: number;
  currency: string;
  firstRecharge: boolean;
  paidAt: string | null;
};

type SendConfirmationInput = {
  recipient: string;
  order: ConfirmationOrder;
  siteOrigin: string;
};

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>'"]/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "'": "&#39;",
        '"': "&quot;",
      })[character] || character,
  );
}

function money(pence: number, currency: string): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: currency.toUpperCase() || "GBP",
  }).format(Math.max(0, pence) / 100);
}

function dateTime(value: string | null): string {
  const date = value ? new Date(value) : new Date();
  return Number.isNaN(date.getTime())
    ? new Date().toLocaleString("en-GB", { timeZone: "Europe/London" })
    : date.toLocaleString("en-GB", { timeZone: "Europe/London" });
}

function cleanOrigin(value: string): string {
  return value.trim().replace(/\/+$/, "");
}

export async function sendWishOrderConfirmation({
  recipient,
  order,
  siteOrigin,
}: SendConfirmationInput): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.ANCIENT_PULLS_ORDER_EMAIL_FROM?.trim();

  if (!apiKey || !from) {
    throw new Error("The order-confirmation email service is not configured.");
  }

  if (!BUSINESS_LEGAL_NAME || !BUSINESS_ADDRESS || !SUPPORT_EMAIL) {
    throw new Error("The public business details are incomplete.");
  }

  const origin = cleanOrigin(
    process.env.NEXT_PUBLIC_SITE_URL?.trim() || siteOrigin,
  );
  const total = money(order.amountPence, order.currency);
  const orderReference = order.id;
  const operator = escapeHtml(BUSINESS_LEGAL_NAME);
  const tradingName = escapeHtml(BUSINESS_TRADING_NAME);
  const address = escapeHtml(BUSINESS_ADDRESS).replace(/\n/g, "<br />");
  const support = escapeHtml(SUPPORT_EMAIL);
  const paidAt = escapeHtml(dateTime(order.paidAt));
  const packageId = escapeHtml(order.packageId);
  const termsUrl = `${origin}/terms`;
  const returnsUrl = `${origin}/returns`;
  const shippingUrl = `${origin}/shipping-policy`;
  const privacyUrl = `${origin}/privacy`;

  const optionalIdentity = [
    COMPANY_NUMBER ? `Company number: ${escapeHtml(COMPANY_NUMBER)}` : "",
    VAT_NUMBER ? `VAT number: ${escapeHtml(VAT_NUMBER)}` : "",
    BUSINESS_PHONE ? `Telephone: ${escapeHtml(BUSINESS_PHONE)}` : "",
  ]
    .filter(Boolean)
    .join("<br />");

  const html = `
    <div style="background:#050617;padding:32px 12px;color:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
      <div style="max-width:680px;margin:0 auto;border:1px solid #252947;border-radius:24px;background:#0a0d25;overflow:hidden">
        <div style="padding:28px 30px;border-bottom:1px solid #252947;background:linear-gradient(135deg,#111638,#16123c)">
          <div style="font-size:12px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:#a5f3fc">Contract confirmation</div>
          <h1 style="margin:10px 0 0;font-size:28px;line-height:1.15;color:#fff">Your ${tradingName} purchase is confirmed</h1>
          <p style="margin:12px 0 0;color:#a9afc8;line-height:1.65">Keep this email. It is your durable record of the order and the key terms that applied when you paid.</p>
        </div>

        <div style="padding:28px 30px">
          <table role="presentation" style="width:100%;border-collapse:collapse;color:#f8fafc">
            <tr><td style="padding:10px 0;color:#9aa2bf">Order reference</td><td style="padding:10px 0;text-align:right;font-weight:800">${escapeHtml(orderReference)}</td></tr>
            <tr><td style="padding:10px 0;color:#9aa2bf">Paid</td><td style="padding:10px 0;text-align:right;font-weight:800">${paidAt}</td></tr>
            <tr><td style="padding:10px 0;color:#9aa2bf">Package</td><td style="padding:10px 0;text-align:right;font-weight:800">${packageId}</td></tr>
            <tr><td style="padding:10px 0;color:#9aa2bf">Wish credits</td><td style="padding:10px 0;text-align:right;font-weight:800">${order.wishes}</td></tr>
            <tr><td style="padding:14px 0 4px;color:#fff;font-size:17px;font-weight:900;border-top:1px solid #252947">Total paid</td><td style="padding:14px 0 4px;text-align:right;color:#fef3c7;font-size:20px;font-weight:900;border-top:1px solid #252947">${escapeHtml(total)}</td></tr>
          </table>

          <div style="margin-top:24px;padding:20px;border:1px solid #2f365d;border-radius:16px;background:#0f1434">
            <h2 style="margin:0;color:#fff;font-size:17px">What you bought</h2>
            <p style="margin:10px 0 0;color:#b7bdd2;line-height:1.7">${order.wishes} wish credits. Each credit you choose to use randomly allocates one genuine physical trading card from the live pool. A particular card, rarity, set or secondary-market value is not guaranteed, and duplicates are possible.</p>
            <p style="margin:10px 0 0;color:#b7bdd2;line-height:1.7">You requested immediate access to the credits. Physical cards are held in your collection until you submit a delivery request. Free delivery unlocks at the displayed threshold; you may contact us to arrange earlier paid delivery, with the price agreed before dispatch.</p>
            <p style="margin:10px 0 0;color:#b7bdd2;line-height:1.7">This is a one-off purchase, not a subscription. There is no minimum contract duration or deposit. Wish credits do not expire under the current terms.</p>
          </div>

          <h2 style="margin:26px 0 8px;color:#fff;font-size:17px">Cancellation, returns and faults</h2>
          <p style="margin:0;color:#b7bdd2;line-height:1.7">You normally have 14 days to cancel a distance purchase. Contact us clearly at <a href="mailto:${support}" style="color:#a5f3fc">${support}</a>. If you use wish credits during that period, any deduction for the part supplied will only be made where the law permits. For physical goods, the cancellation period normally ends 14 days after receipt. Faulty, damaged, misdescribed or incorrect goods have separate statutory remedies. Nothing in these terms limits rights that cannot lawfully be excluded.</p>
          <p style="margin:10px 0 0;color:#b7bdd2;line-height:1.7">Refunds are made to the original payment method within the legal time limits. Standard outbound delivery is refundable where required; extra paid for an upgraded delivery service is not. You usually pay return postage for a change-of-mind return, but not for faulty, damaged, misdescribed or incorrect goods.</p>

          <h2 style="margin:26px 0 8px;color:#fff;font-size:17px">Model cancellation wording</h2>
          <div style="padding:16px;border-left:3px solid #67e8f9;background:#0d122d;color:#cbd1e2;line-height:1.65">To ${operator}: I give notice that I cancel my contract for order ${escapeHtml(orderReference)}. My name is [name]. My address is [address]. The order date was [date]. Signed [only if sent on paper]. Date [date].</div>

          <h2 style="margin:26px 0 8px;color:#fff;font-size:17px">Operator and contact details</h2>
          <p style="margin:0;color:#b7bdd2;line-height:1.7">${operator}, trading as ${tradingName}<br />${address}<br />Email: <a href="mailto:${support}" style="color:#a5f3fc">${support}</a>${optionalIdentity ? `<br />${optionalIdentity}` : ""}</p>

          <p style="margin:26px 0 0;color:#8992ae;line-height:1.65;font-size:13px">The applicable policies were last updated ${escapeHtml(LEGAL_LAST_UPDATED)}: <a href="${termsUrl}" style="color:#a5f3fc">Terms</a> · <a href="${returnsUrl}" style="color:#a5f3fc">Returns</a> · <a href="${shippingUrl}" style="color:#a5f3fc">Shipping</a> · <a href="${privacyUrl}" style="color:#a5f3fc">Privacy</a>.</p>
        </div>
      </div>
    </div>`;

  const text = [
    `${BUSINESS_TRADING_NAME} — contract confirmation`,
    `Order reference: ${order.id}`,
    `Paid: ${dateTime(order.paidAt)}`,
    `Package: ${order.packageId}`,
    `Wish credits: ${order.wishes}`,
    `Total paid: ${total}`,
    "",
    "What you bought",
    `${order.wishes} wish credits. Each used credit randomly allocates one genuine physical trading card. No particular card, rarity, set or secondary-market value is guaranteed; duplicates are possible. You requested immediate access. Cards are held in your collection until you request delivery.`,
    "This is a one-off purchase, not a subscription. There is no minimum contract duration or deposit. Wish credits do not expire under the current terms.",
    "",
    "Cancellation and returns",
    `You normally have 14 days to cancel a distance purchase. Email ${SUPPORT_EMAIL}. Using credits during that period may reduce a refund only where the law permits. For physical goods, the cancellation period normally ends 14 days after receipt. Statutory rights for faulty, damaged, misdescribed or incorrect goods remain.`,
    "",
    "Model cancellation wording",
    `To ${BUSINESS_LEGAL_NAME}: I give notice that I cancel my contract for order ${order.id}. My name is [name]. My address is [address]. The order date was [date]. Signed [only if sent on paper]. Date [date].`,
    "",
    `${BUSINESS_LEGAL_NAME}, trading as ${BUSINESS_TRADING_NAME}`,
    BUSINESS_ADDRESS,
    `Email: ${SUPPORT_EMAIL}`,
    BUSINESS_PHONE ? `Telephone: ${BUSINESS_PHONE}` : "",
    COMPANY_NUMBER ? `Company number: ${COMPANY_NUMBER}` : "",
    VAT_NUMBER ? `VAT number: ${VAT_NUMBER}` : "",
    "",
    `Terms: ${termsUrl}`,
    `Returns: ${returnsUrl}`,
    `Shipping: ${shippingUrl}`,
    `Privacy: ${privacyUrl}`,
  ]
    .filter((line) => line !== "")
    .join("\n");

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": `ancient-pulls-order-${order.id}-v1`,
    },
    body: JSON.stringify({
      from,
      to: [recipient],
      reply_to: SUPPORT_EMAIL,
      subject: `Order confirmed · ${order.wishes} wishes · ${order.id.slice(0, 8)}`,
      html,
      text,
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as {
      message?: unknown;
    } | null;
    const message =
      typeof payload?.message === "string" && payload.message.trim()
        ? payload.message.trim()
        : "The contract-confirmation email could not be sent.";
    throw new Error(message);
  }
}
