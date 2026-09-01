import Link from "next/link";

import {
  InfoCallout,
  Section,
  TrustShell,
} from "@/components/player/TrustShell";
import {
  BUSINESS_ADDRESS,
  BUSINESS_DETAILS_COMPLETE,
  BUSINESS_LEGAL_NAME,
  BUSINESS_PHONE,
  BUSINESS_TRADING_NAME,
  COMPANY_NUMBER,
  PRIVACY_EMAIL,
  SUPPORT_EMAIL,
  VAT_NUMBER,
} from "@/lib/player/legal";

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
      <dt className="text-[0.65rem] font-black uppercase tracking-[0.14em] text-white/35">{label}</dt>
      <dd className="mt-2 whitespace-pre-line font-black leading-6 text-white/80">{value || "Not yet configured — orders remain locked"}</dd>
    </div>
  );
}

export default function ContactPage() {
  return (
    <TrustShell
      eyebrow="Business & contact"
      title="The operator behind Ancient Pulls"
      intro="Legal identity, geographic address and direct routes for customer service, cancellations, returns and privacy matters."
    >
      <InfoCallout
        title={BUSINESS_DETAILS_COMPLETE ? "Orders can identify the trader" : "Pre-launch protection"}
        tone={BUSINESS_DETAILS_COMPLETE ? "emerald" : "yellow"}
      >
        {BUSINESS_DETAILS_COMPLETE
          ? "The required public operator and contact fields are configured."
          : "A required business field is still blank. Ancient Pulls automatically keeps paid orders closed until the legal operator, geographic address and contact emails are configured."}
      </InfoCallout>

      <Section title="Business details">
        <dl className="grid gap-3 sm:grid-cols-2">
          <Detail label="Trading name" value={BUSINESS_TRADING_NAME} />
          <Detail label="Legal operator" value={BUSINESS_LEGAL_NAME} />
          <Detail label="Geographic business address" value={BUSINESS_ADDRESS} />
          <Detail label="Customer-service email" value={SUPPORT_EMAIL} />
          <Detail label="Privacy contact" value={PRIVACY_EMAIL} />
          <Detail label="Telephone (if provided)" value={BUSINESS_PHONE || "Not provided"} />
          {COMPANY_NUMBER ? <Detail label="Company number" value={COMPANY_NUMBER} /> : null}
          {VAT_NUMBER ? <Detail label="VAT number" value={VAT_NUMBER} /> : null}
        </dl>
      </Section>

      <Section title="Customer service, cancellation and returns">
        <p>
          Signed-in players can open and track a conversation only inside the{" "}
          <Link className="text-cyan-100 underline underline-offset-2" href="/help#support">Support panel in Help</Link>.
          You can also send a clear cancellation, return request or complaint to{" "}
          {SUPPORT_EMAIL ? <a className="text-cyan-100 underline underline-offset-2" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> : "the email above once configured"}.
        </p>
        <p>Do not send passwords or complete payment-card details.</p>
      </Section>

      <Section title="Privacy requests and complaints">
        <p>
          Email {PRIVACY_EMAIL ? <a className="text-cyan-100 underline underline-offset-2" href={`mailto:${PRIVACY_EMAIL}`}>{PRIVACY_EMAIL}</a> : "the configured privacy address"} or clearly identify the issue as a data-protection complaint in Help. We acknowledge data-protection complaints within 30 days, investigate without undue delay, keep you informed and explain the outcome. See the{" "}
          <Link className="text-cyan-100 underline underline-offset-2" href="/privacy">Privacy Notice</Link>.
        </p>
      </Section>

      <Section title="Policy directory">
        <div className="flex flex-wrap gap-2">
          {[
            ["/terms", "Terms & Conditions"],
            ["/returns", "Refunds & Returns"],
            ["/shipping-policy", "Shipping Policy"],
            ["/privacy", "Privacy Notice"],
            ["/cookies", "Cookie Policy"],
          ].map(([href, label]) => (
            <Link key={href} href={href} className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-black text-white/65 transition hover:border-cyan-100/20 hover:text-white">
              {label}
            </Link>
          ))}
        </div>
      </Section>
    </TrustShell>
  );
}
