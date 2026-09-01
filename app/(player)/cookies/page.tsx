import Link from "next/link";

import {
  CompactList,
  InfoCallout,
  Section,
  TrustShell,
} from "@/components/player/TrustShell";

const STORAGE = [
  {
    category: "Authentication and security",
    provider: "Ancient Pulls / Supabase",
    purpose: "Keep you signed in, refresh an authenticated session and protect account-only requests.",
    duration: "Session-dependent; removed on sign-out where supported, or when the token expires/browser data is cleared.",
    status: "Strictly necessary",
  },
  {
    category: "Pending registration",
    provider: "Ancient Pulls",
    purpose: "Remember the email awaiting verification and enforce the resend cooldown without making you recreate the account.",
    duration: "Up to 30 days, then removed automatically when read; also cleared after successful sign-in or when you choose another account.",
    status: "Strictly necessary for the requested signup flow",
  },
  {
    category: "Accessibility and player preferences",
    provider: "Ancient Pulls",
    purpose: "Remember sound levels, reduced motion, low-effects/data-saver choices, text size and cinematic preference.",
    duration: "Until you change the preference or clear site data.",
    status: "Requested preference / appearance",
  },
  {
    category: "Nebu presentation",
    provider: "Ancient Pulls",
    purpose: "Remember the selected Nebu skin, performance and wish sound choice.",
    duration: "Until you change the choice or clear site data.",
    status: "Requested preference / appearance",
  },
  {
    category: "Onboarding progress",
    provider: "Ancient Pulls",
    purpose: "Remember completed or paused guidance so it does not repeatedly interrupt you.",
    duration: "Until the relevant guide is reset or site data is cleared; paused state may last only for the browser session.",
    status: "Service functionality",
  },
  {
    category: "Cookie notice choice",
    provider: "Ancient Pulls",
    purpose: "Remember that the essential-storage notice has been read.",
    duration: "Until policy version changes or site data is cleared.",
    status: "Strictly necessary to remember the choice",
  },
] as const;

export default function CookiesPage() {
  return (
    <TrustShell
      eyebrow="Cookie policy"
      title="No advertising trackers. No hidden analytics consent."
      intro="“Cookies” here includes cookies, local storage, session storage and similar browser technologies covered by UK privacy rules."
    >
      <InfoCallout title="Current setting" tone="emerald">
        Ancient Pulls currently uses essential storage and settings you ask the service to remember. Optional analytics and advertising trackers are off. Because none are loaded, there is no fake “Accept all” choice.
      </InfoCallout>

      <Section title="1. Storage used by Ancient Pulls">
        <div className="grid gap-3">
          {STORAGE.map((item) => (
            <article key={item.category} className="rounded-2xl border border-white/10 bg-black/10 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-black text-white/85">{item.category}</h3>
                <span className="rounded-full border border-cyan-100/15 bg-cyan-100/[0.05] px-2.5 py-1 text-[0.6rem] font-black uppercase tracking-wide text-cyan-50/60">{item.status}</span>
              </div>
              <p><span className="font-black text-white/65">Provider:</span> {item.provider}</p>
              <p><span className="font-black text-white/65">Purpose:</span> {item.purpose}</p>
              <p><span className="font-black text-white/65">Duration:</span> {item.duration}</p>
            </article>
          ))}
        </div>
      </Section>

      <Section title="2. Payment and linked services">
        <p>
          When you choose secure payment, you leave Ancient Pulls for Stripe&apos;s hosted checkout. Stripe can use cookies and similar technologies for payment, fraud prevention and regulatory purposes under its own notices. Linked sites may do the same. Ancient Pulls does not use those third-party technologies to add advertising trackers to this service.
        </p>
      </Section>

      <Section title="3. Optional technology">
        <p>
          We do not currently load optional analytics, advertising pixels, cross-site tracking or personalised-advertising technology. If that changes, non-exempt technology will remain off until the required consent is obtained. The choice will be specific, equally easy to accept or refuse, recorded, and as easy to withdraw as it was to give.
        </p>
      </Section>

      <Section title="4. How to control storage">
        <CompactList>
          <li>Use settings in your browser to view, delete or block cookies and site data.</li>
          <li>Use Ancient Pulls preferences to change accessibility, sound, performance and cinematic choices.</li>
          <li>Signing out ends the active account session, but your browser may retain non-sensitive preferences until you clear them.</li>
          <li>Blocking essential authentication storage can prevent sign-in, checkout, Collection, shipping and other account features from working.</li>
        </CompactList>
        <p>
          Clearing storage also resets this notice. If optional technology is introduced, a persistent control will let you reopen the consent choices without searching through this policy.
        </p>
      </Section>

      <Section title="5. Personal information">
        <p>
          Browser identifiers and security logs can be personal information even when they do not contain your name. The purposes, lawful bases, recipients, retention rules and your rights are explained in the{" "}
          <Link className="text-cyan-100 underline underline-offset-2" href="/privacy">Privacy Notice</Link>.
        </p>
      </Section>
    </TrustShell>
  );
}
