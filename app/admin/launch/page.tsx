"use client";

import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";

import AdminNav from "@/components/AdminNav";
import { adminFetch } from "@/lib/admin/client-auth";

// Launch Control intentionally renders heterogeneous audited database rows.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type JsonRecord = Record<string, any>;

type LaunchSettings = {
  beta_mode: boolean;
  maintenance_mode: boolean;
  maintenance_message: string;
  purchases_enabled: boolean;
  wishes_enabled: boolean;
  trades_enabled: boolean;
  shipping_enabled: boolean;
  scanner_auto_write_enabled: boolean;
  inventory_backed_wishes: boolean;
  global_daily_revenue_limit_pence: number;
  default_daily_spend_limit_pence: number;
  default_daily_wish_limit: number;
  legal_review_status: "pending" | "approved" | "rejected" | "expired";
  legal_review_reference: string;
  scanner_release_status: "shadow" | "passed" | "blocked";
};

type LaunchSnapshot = {
  ok: true;
  generatedAt: string;
  settings: LaunchSettings;
  readiness: Record<string, boolean>;
  metrics: Record<string, number>;
  betaMembers: JsonRecord[];
  scannerBenchmarks: JsonRecord[];
  tickets: JsonRecord[];
  sourcing: JsonRecord[];
  shipments: JsonRecord[];
  webhookProblems: JsonRecord[];
  financialExceptions: JsonRecord[];
  audit: JsonRecord[];
};

type TicketThread = {
  ticket: JsonRecord;
  messages: JsonRecord[];
  attachments: JsonRecord[];
};

const SETTING_TOGGLES: Array<{
  key: keyof LaunchSettings;
  label: string;
  note: string;
  dangerous?: boolean;
}> = [
  { key: "beta_mode", label: "Founder beta", note: "Only allow accounts in the beta list." },
  { key: "maintenance_mode", label: "Maintenance", note: "Pause player mutations immediately.", dangerous: true },
  { key: "purchases_enabled", label: "Paid purchases", note: "Requires every release gate to pass.", dangerous: true },
  { key: "wishes_enabled", label: "Wish allocation", note: "Allow players to spend held wish credits." },
  { key: "trades_enabled", label: "Trading", note: "Allow new or changed trades." },
  { key: "shipping_enabled", label: "Shipping requests", note: "Allow players to request fulfilment." },
  { key: "scanner_auto_write_enabled", label: "Scanner auto-write", note: "Only passing, operator-verified scans can unlock this.", dangerous: true },
];

const METRIC_LABELS: Record<string, string> = {
  physicalUnits: "Physical units",
  catalogueCards: "Catalogue cards",
  enabledPoolCards: "Wish-pool designs",
  visualIndexCards: "Visual index",
  readyObligations: "Cards owed",
  sourcingObligations: "Sourcing debt",
  openSupportTickets: "Open tickets",
  activeShipments: "Active shipments",
  revenueTodayPence: "Paid today",
  pendingRevenuePence: "Pending today",
  paidOrdersToday: "Paid orders",
};

function formatValue(key: string, value: number): string {
  if (key.toLowerCase().includes("pence")) {
    return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(value / 100);
  }
  return new Intl.NumberFormat("en-GB").format(value || 0);
}

function dateLabel(value: unknown): string {
  if (typeof value !== "string" || !value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString("en-GB");
}

function text(value: unknown): string {
  return typeof value === "string" ? value : value === null || value === undefined ? "" : String(value);
}

function Panel({ title, subtitle, children }: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[1.7rem] border border-white/10 bg-[#071a14]/92 p-4 shadow-[0_20px_65px_rgba(0,0,0,.22)] sm:p-6">
      <h2 className="text-lg font-black text-white sm:text-xl">{title}</h2>
      {subtitle ? <p className="mt-1 text-xs font-semibold leading-5 text-white/40">{subtitle}</p> : null}
      <div className="mt-4">{children}</div>
    </section>
  );
}

export default function LaunchControlPage() {
  const [snapshot, setSnapshot] = useState<LaunchSnapshot | null>(null);
  const [draft, setDraft] = useState<LaunchSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [betaEmail, setBetaEmail] = useState("");
  const [betaNotes, setBetaNotes] = useState("");
  const [ticketThread, setTicketThread] = useState<TicketThread | null>(null);
  const [ticketReply, setTicketReply] = useState("");
  const [benchmarkFile, setBenchmarkFile] = useState<File | null>(null);
  const [shipmentEdits, setShipmentEdits] = useState<Record<string, { status: string; trackingNumber: string; trackingUrl: string }>>({});

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    setError("");
    try {
      const result = await adminFetch<LaunchSnapshot>("/api/admin/launch-control");
      setSnapshot(result);
      setDraft(result.settings);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Launch Control could not be loaded.");
    } finally {
      if (!quiet) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => { void load(); });
    return () => window.cancelAnimationFrame(frame);
  }, [load]);

  const readyCount = useMemo(() => snapshot
    ? Object.values(snapshot.readiness).filter(Boolean).length
    : 0, [snapshot]);
  const readinessCount = snapshot ? Object.keys(snapshot.readiness).length : 0;

  async function action(payload: JsonRecord, success: string) {
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await adminFetch("/api/admin/launch-control", {
        method: "POST",
        headers: { "X-Request-Id": crypto.randomUUID() },
        body: JSON.stringify(payload),
      });
      setNotice(success);
      await load(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The operation failed.");
    } finally {
      setSaving(false);
    }
  }

  async function saveSettings() {
    if (!draft) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await adminFetch("/api/admin/launch-control", {
        method: "PATCH",
        headers: { "X-Request-Id": crypto.randomUUID() },
        body: JSON.stringify({ settings: draft }),
      });
      setNotice("Launch controls saved and written to the audit ledger.");
      await load(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Launch controls could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  async function addBetaMember(event: FormEvent) {
    event.preventDefault();
    await action({ action: "beta.add", email: betaEmail, notes: betaNotes }, "Founder beta member added.");
    setBetaEmail("");
    setBetaNotes("");
  }

  async function openTicket(id: string) {
    setSaving(true);
    setError("");
    try {
      const result = await adminFetch<{ ok: true; thread: TicketThread }>(`/api/admin/launch-control?ticket=${encodeURIComponent(id)}`);
      setTicketThread(result.thread);
      setTicketReply("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The support ticket could not be opened.");
    } finally {
      setSaving(false);
    }
  }

  async function replyTicket(event: FormEvent) {
    event.preventDefault();
    if (!ticketThread || !ticketReply.trim()) return;
    await action({
      action: "support.reply",
      ticketId: ticketThread.ticket.id,
      message: ticketReply,
    }, "Support reply sent.");
    setTicketReply("");
    await openTicket(text(ticketThread.ticket.id));
  }

  async function importBenchmark() {
    if (!benchmarkFile) return;
    setSaving(true);
    setError("");
    try {
      const raw = await benchmarkFile.text();
      const parsed = JSON.parse(raw) as JsonRecord;
      const summary = parsed.summary as JsonRecord | undefined;
      if (parsed.schemaVersion !== 2 || !summary || typeof parsed.scannerVersion !== "string") {
        throw new Error("Choose a scanner v53.1 benchmark export.");
      }
      const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
      const sha = Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
      await action({
        action: "scanner.record_benchmark",
        scannerVersion: parsed.scannerVersion,
        totalSamples: summary.totalSamples,
        autoAcceptedSamples: summary.autoAcceptedSamples,
        wrongAutoWrites: summary.wrongAutoWrites,
        unresolvedSamples: summary.unresolvedSamples,
        queueDrops: summary.queueDrops,
        duplicateWrites: summary.duplicateWrites,
        p95LatencyMs: summary.p95LatencyMs,
        datasetSha256: sha,
        records: parsed.records,
      }, "Scanner benchmark recorded. Its pass/fail result is now enforced server-side.");
      setBenchmarkFile(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The benchmark could not be imported.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#03110c] bg-[radial-gradient(circle_at_top,rgba(16,185,129,.14),transparent_36rem)] px-3 pb-24 pt-3 text-white sm:px-5 lg:px-8 lg:pt-8">
      <div className="mx-auto max-w-[1440px]">
        <AdminNav />

        <header className="mt-4 overflow-hidden rounded-[2rem] border border-emerald-100/15 bg-[#071a14]/95 p-5 sm:p-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[.2em] text-emerald-200/55">Production operations</p>
              <h1 className="mt-2 text-3xl font-black tracking-[-.04em] sm:text-5xl">Launch Control</h1>
              <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-white/45">One place for release gates, real stock, payments, scanner evidence, customer support and fulfilment.</p>
            </div>
            <div className={`rounded-2xl border px-5 py-4 ${readyCount === readinessCount && readinessCount ? "border-emerald-300/30 bg-emerald-300/10" : "border-amber-300/30 bg-amber-300/10"}`}>
              <div className="text-xs font-black uppercase tracking-[.14em] text-white/50">Release readiness</div>
              <div className="mt-1 text-3xl font-black">{readyCount}/{readinessCount || "—"}</div>
            </div>
          </div>
        </header>

        {error ? <div className="mt-4 rounded-2xl border border-rose-300/25 bg-rose-300/10 p-4 text-sm font-bold text-rose-100">{error}</div> : null}
        {notice ? <div className="mt-4 rounded-2xl border border-emerald-300/25 bg-emerald-300/10 p-4 text-sm font-bold text-emerald-100">{notice}</div> : null}

        {loading || !snapshot || !draft ? (
          <div className="mt-6 rounded-3xl border border-white/10 bg-white/[.03] p-10 text-center font-black text-white/50">Loading release state…</div>
        ) : (
          <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,.85fr)]">
            <div className="space-y-5">
              <Panel title="Hard release gates" subtitle="A paid launch cannot be enabled unless every required server check passes.">
                <div className="grid gap-2 sm:grid-cols-2">
                  {Object.entries(snapshot.readiness).map(([key, ready]) => (
                    <div key={key} className={`flex items-center gap-3 rounded-xl border px-3 py-3 ${ready ? "border-emerald-300/15 bg-emerald-300/[.055]" : "border-rose-300/15 bg-rose-300/[.055]"}`}>
                      <span className={`grid h-7 w-7 place-items-center rounded-lg text-xs font-black ${ready ? "bg-emerald-300 text-emerald-950" : "bg-rose-300 text-rose-950"}`}>{ready ? "✓" : "!"}</span>
                      <span className="text-xs font-black capitalize text-white/75">{key.replace(/([A-Z])/g, " $1")}</span>
                    </div>
                  ))}
                </div>
              </Panel>

              <Panel title="Live controls" subtitle="Dangerous switches remain fail-closed even if the browser is tampered with.">
                <div className="grid gap-2 sm:grid-cols-2">
                  {SETTING_TOGGLES.map((item) => (
                    <label key={item.key} className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 ${item.dangerous ? "border-amber-200/15 bg-amber-200/[.035]" : "border-white/10 bg-black/15"}`}>
                      <input
                        type="checkbox"
                        checked={draft[item.key] === true}
                        onChange={(event) => setDraft({ ...draft, [item.key]: event.target.checked })}
                        className="mt-1 h-5 w-5 accent-emerald-300"
                      />
                      <span><span className="block text-sm font-black">{item.label}</span><span className="mt-1 block text-[11px] font-semibold leading-4 text-white/35">{item.note}</span></span>
                    </label>
                  ))}
                </div>

                <label className="mt-3 block text-xs font-black text-white/55">Maintenance message
                  <input value={draft.maintenance_message} onChange={(event) => setDraft({ ...draft, maintenance_message: event.target.value })} className="mt-1.5 min-h-12 w-full rounded-xl border border-white/10 bg-black/20 px-3 text-sm text-white outline-none focus:border-emerald-300/35" />
                </label>

                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  <label className="text-xs font-black text-white/55">Daily revenue £
                    <input type="number" min="0" step="1" value={draft.global_daily_revenue_limit_pence / 100} onChange={(event) => setDraft({ ...draft, global_daily_revenue_limit_pence: Math.max(0, Math.round(Number(event.target.value) * 100)) })} className="mt-1.5 min-h-12 w-full rounded-xl border border-white/10 bg-black/20 px-3 text-white" />
                  </label>
                  <label className="text-xs font-black text-white/55">Player spend £
                    <input type="number" min="0" step="1" value={draft.default_daily_spend_limit_pence / 100} onChange={(event) => setDraft({ ...draft, default_daily_spend_limit_pence: Math.max(0, Math.round(Number(event.target.value) * 100)) })} className="mt-1.5 min-h-12 w-full rounded-xl border border-white/10 bg-black/20 px-3 text-white" />
                  </label>
                  <label className="text-xs font-black text-white/55">Daily wishes
                    <input type="number" min="1" value={draft.default_daily_wish_limit} onChange={(event) => setDraft({ ...draft, default_daily_wish_limit: Math.max(1, Math.floor(Number(event.target.value))) })} className="mt-1.5 min-h-12 w-full rounded-xl border border-white/10 bg-black/20 px-3 text-white" />
                  </label>
                </div>

                <div className="mt-4 rounded-2xl border border-cyan-200/15 bg-cyan-200/[.04] p-4">
                  <div className="grid gap-3 sm:grid-cols-[12rem_1fr]">
                    <label className="text-xs font-black text-white/55">Legal review state
                      <select value={draft.legal_review_status} onChange={(event) => setDraft({ ...draft, legal_review_status: event.target.value as LaunchSettings["legal_review_status"] })} className="mt-1.5 min-h-12 w-full rounded-xl border border-white/10 bg-[#071a14] px-3 text-white">
                        <option value="pending">Pending</option><option value="approved">Approved</option><option value="rejected">Rejected</option><option value="expired">Expired</option>
                      </select>
                    </label>
                    <label className="text-xs font-black text-white/55">Independent review reference
                      <input value={draft.legal_review_reference} onChange={(event) => setDraft({ ...draft, legal_review_reference: event.target.value })} placeholder="Solicitor, date and engagement/reference" className="mt-1.5 min-h-12 w-full rounded-xl border border-white/10 bg-black/20 px-3 text-white" />
                    </label>
                  </div>
                  <p className="mt-2 text-[11px] font-semibold leading-4 text-cyan-50/45">Only record “Approved” after an independent UK solicitor has reviewed the live commercial model and documents.</p>
                </div>

                <button type="button" disabled={saving} onClick={() => void saveSettings()} className="mt-4 min-h-12 w-full rounded-xl bg-emerald-300 px-4 text-sm font-black text-emerald-950 disabled:opacity-50">{saving ? "Saving…" : "Save audited controls"}</button>
              </Panel>

              <Panel title="Operations queue" subtitle="Items requiring action before a clean release.">
                <div className="grid gap-4 lg:grid-cols-2">
                  <div>
                    <h3 className="text-xs font-black uppercase tracking-[.14em] text-white/45">Support · {snapshot.tickets.length}</h3>
                    <div className="mt-2 space-y-2">
                      {snapshot.tickets.slice(0, 8).map((ticket) => (
                        <button key={ticket.id} type="button" onClick={() => void openTicket(text(ticket.id))} className="block w-full rounded-xl border border-white/10 bg-black/15 p-3 text-left hover:bg-white/[.04]">
                          <div className="flex justify-between gap-2"><span className="truncate text-sm font-black">#{ticket.ticket_number} {ticket.subject}</span><span className="text-[10px] font-black text-amber-200">{ticket.status}</span></div>
                          <div className="mt-1 text-[10px] text-white/35">{ticket.category} · {dateLabel(ticket.last_message_at)}</div>
                        </button>
                      ))}
                      {!snapshot.tickets.length ? <p className="text-xs font-semibold text-white/35">No tickets.</p> : null}
                    </div>
                  </div>
                  <div>
                    <h3 className="text-xs font-black uppercase tracking-[.14em] text-white/45">Fulfilment exceptions · {snapshot.sourcing.length}</h3>
                    <div className="mt-2 space-y-2">
                      {snapshot.sourcing.slice(0, 8).map((item) => (
                        <div key={item.id} className="rounded-xl border border-rose-200/15 bg-rose-200/[.035] p-3">
                          <div className="text-sm font-black">{item.card?.name || item.card_id}</div>
                          <div className="mt-1 text-[10px] text-white/35">{item.card?.set_name || "Unknown set"} · owed since {dateLabel(item.created_at)}</div>
                          <button type="button" disabled={saving} onClick={() => void action({ action: "sourcing.mark_sourced", obligationId: item.id }, "Physical source linked to fulfilment.")} className="mt-2 rounded-lg border border-emerald-200/20 bg-emerald-200/10 px-2.5 py-1.5 text-[10px] font-black text-emerald-100">Mark sourced</button>
                        </div>
                      ))}
                      {!snapshot.sourcing.length ? <p className="text-xs font-semibold text-emerald-200/60">No sourcing debt.</p> : null}
                    </div>
                  </div>
                </div>
                <div className="mt-5 border-t border-white/10 pt-5">
                  <h3 className="text-xs font-black uppercase tracking-[.14em] text-white/45">Active shipments · {snapshot.shipments.length}</h3>
                  <div className="mt-2 space-y-3">
                    {snapshot.shipments.map((shipment) => {
                      const id = text(shipment.id);
                      const edit = shipmentEdits[id] || {
                        status: text(shipment.status) || "requested",
                        trackingNumber: text(shipment.tracking_number),
                        trackingUrl: text(shipment.tracking_url),
                      };
                      return (
                        <div key={id} className="rounded-xl border border-white/10 bg-black/15 p-3">
                          <div className="flex justify-between gap-2"><span className="text-sm font-black">{shipment.card_count} cards</span><span className="text-[10px] font-black text-cyan-100/55">{dateLabel(shipment.requested_at)}</span></div>
                          <div className="mt-2 grid gap-2 sm:grid-cols-3">
                            <select value={edit.status} onChange={(event) => setShipmentEdits({ ...shipmentEdits, [id]: { ...edit, status: event.target.value } })} className="min-h-11 rounded-lg border border-white/10 bg-[#071a14] px-2 text-xs font-bold text-white"><option value="requested">Requested</option><option value="packing">Packing</option><option value="shipped">Shipped</option><option value="delivered">Delivered</option><option value="cancelled">Cancelled</option></select>
                            <input value={edit.trackingNumber} onChange={(event) => setShipmentEdits({ ...shipmentEdits, [id]: { ...edit, trackingNumber: event.target.value } })} placeholder="Tracking number" className="min-h-11 rounded-lg border border-white/10 bg-black/20 px-2 text-xs text-white" />
                            <input value={edit.trackingUrl} onChange={(event) => setShipmentEdits({ ...shipmentEdits, [id]: { ...edit, trackingUrl: event.target.value } })} placeholder="Tracking URL" className="min-h-11 rounded-lg border border-white/10 bg-black/20 px-2 text-xs text-white" />
                          </div>
                          <button type="button" disabled={saving} onClick={() => void action({ action: "shipment.update", shipmentId: id, ...edit }, "Shipment and player timeline updated.")} className="mt-2 min-h-10 w-full rounded-lg border border-cyan-200/20 bg-cyan-200/10 px-3 text-[10px] font-black text-cyan-100">Save shipment</button>
                        </div>
                      );
                    })}
                    {!snapshot.shipments.length ? <p className="text-xs font-semibold text-white/35">No active shipments.</p> : null}
                  </div>
                </div>
              </Panel>
            </div>

            <div className="space-y-5">
              <Panel title="Today at a glance">
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(snapshot.metrics).map(([key, value]) => (
                    <div key={key} className="rounded-xl border border-white/10 bg-black/15 p-3"><div className="text-[10px] font-black uppercase tracking-wide text-white/35">{METRIC_LABELS[key] || key}</div><div className="mt-1 text-xl font-black">{formatValue(key, value)}</div></div>
                  ))}
                </div>
              </Panel>

              <Panel title="Founder beta" subtitle="Start with controlled accounts and daily limits.">
                <form onSubmit={addBetaMember} className="space-y-2">
                  <input type="email" required value={betaEmail} onChange={(event) => setBetaEmail(event.target.value)} placeholder="player@example.com" className="min-h-12 w-full rounded-xl border border-white/10 bg-black/20 px-3 text-sm text-white" />
                  <input value={betaNotes} onChange={(event) => setBetaNotes(event.target.value)} placeholder="Notes (optional)" className="min-h-12 w-full rounded-xl border border-white/10 bg-black/20 px-3 text-sm text-white" />
                  <button disabled={saving} className="min-h-11 w-full rounded-xl bg-cyan-200 px-3 text-xs font-black text-cyan-950 disabled:opacity-50">Add beta member</button>
                </form>
                <div className="mt-3 max-h-64 space-y-2 overflow-y-auto">
                  {snapshot.betaMembers.map((member) => (
                    <div key={member.id} className="flex items-center justify-between gap-2 rounded-xl border border-white/10 p-3">
                      <div className="min-w-0"><div className="truncate text-xs font-black">{member.email || member.user_id}</div><div className="mt-1 text-[10px] text-white/35">{member.active ? "Active" : "Disabled"}</div></div>
                      {member.active ? <button type="button" disabled={saving} onClick={() => void action({ action: "beta.disable", id: member.id }, "Beta member disabled.")} className="rounded-lg border border-rose-200/20 px-2 py-1 text-[10px] font-black text-rose-100">Disable</button> : null}
                    </div>
                  ))}
                </div>
              </Panel>

              <Panel title="Scanner release evidence" subtitle="Import operator-verified mobile scans; never self-certify unreviewed predictions.">
                <input type="file" accept="application/json,.json" onChange={(event) => setBenchmarkFile(event.target.files?.[0] || null)} className="block w-full text-xs text-white/55 file:mr-3 file:rounded-lg file:border-0 file:bg-fuchsia-200 file:px-3 file:py-2 file:font-black file:text-fuchsia-950" />
                <button type="button" disabled={!benchmarkFile || saving} onClick={() => void importBenchmark()} className="mt-3 min-h-11 w-full rounded-xl bg-fuchsia-200 px-3 text-xs font-black text-fuchsia-950 disabled:opacity-40">Record locked benchmark</button>
                <div className="mt-3 space-y-2">
                  {snapshot.scannerBenchmarks.slice(0, 3).map((benchmark) => (
                    <div key={benchmark.id} className={`rounded-xl border p-3 ${benchmark.passed ? "border-emerald-200/20 bg-emerald-200/[.045]" : "border-rose-200/20 bg-rose-200/[.045]"}`}>
                      <div className="flex justify-between gap-2"><span className="text-xs font-black">{benchmark.scanner_version}</span><span className="text-xs font-black">{benchmark.passed ? "PASS" : "BLOCKED"}</span></div>
                      <div className="mt-1 text-[10px] text-white/40">{benchmark.total_samples} verified · {benchmark.wrong_auto_writes} wrong auto · p95 {benchmark.p95_latency_ms}ms</div>
                    </div>
                  ))}
                </div>
              </Panel>

              <Panel title="Payment reconciliation">
                {snapshot.webhookProblems.length ? snapshot.webhookProblems.map((problem) => (
                  <div key={problem.event_id} className="mb-2 rounded-xl border border-rose-200/20 bg-rose-200/[.04] p-3"><div className="text-xs font-black">{problem.event_type}</div><div className="mt-1 break-words text-[10px] text-rose-50/55">{problem.error_message || problem.processing_status} · attempt {problem.attempt_count}</div></div>
                )) : <p className="text-xs font-semibold text-emerald-200/60">No failed or stuck Stripe events.</p>}
                {snapshot.financialExceptions.map((order) => <div key={order.id} className="mt-2 rounded-xl border border-amber-200/20 bg-amber-200/[.04] p-3"><div className="text-xs font-black">Order {text(order.id).slice(0, 8)} · {order.status}</div><div className="mt-1 text-[10px] text-amber-50/55">{formatValue("amountPence", Number(order.amount_pence) || 0)} · {order.failure_reason || "Manual credit reconciliation required"}</div></div>)}
              </Panel>

              <Panel title="Recent audit trail">
                <div className="max-h-80 space-y-2 overflow-y-auto">
                  {snapshot.audit.slice(0, 20).map((event) => <div key={event.id} className="rounded-xl border border-white/10 bg-black/15 p-3"><div className="text-xs font-black">{event.action}</div><div className="mt-1 text-[10px] text-white/35">{event.admin_email} · {event.target_type} · {dateLabel(event.created_at)}</div></div>)}
                </div>
              </Panel>
            </div>
          </div>
        )}
      </div>

      {ticketThread ? (
        <div className="fixed inset-0 z-[100] overflow-y-auto bg-black/80 p-3 backdrop-blur sm:p-6" role="dialog" aria-modal="true" aria-label="Support ticket">
          <div className="mx-auto max-w-2xl rounded-[1.7rem] border border-white/15 bg-[#071a14] p-4 sm:p-6">
            <div className="flex items-start justify-between gap-3"><div><div className="text-xs font-black text-cyan-100">Ticket #{text(ticketThread.ticket.ticket_number)}</div><h2 className="mt-1 text-xl font-black">{text(ticketThread.ticket.subject)}</h2></div><button type="button" onClick={() => setTicketThread(null)} className="grid h-11 w-11 place-items-center rounded-xl border border-white/10 text-xl">×</button></div>
            <div className="mt-3 flex flex-wrap gap-2"><button type="button" disabled={saving} onClick={() => void action({ action: "support.update", ticketId: ticketThread.ticket.id, status: "resolved", priority: ticketThread.ticket.priority || "normal" }, "Support ticket resolved.").then(() => setTicketThread(null))} className="rounded-lg border border-emerald-200/20 bg-emerald-200/10 px-3 py-2 text-[10px] font-black text-emerald-100">Resolve ticket</button><button type="button" disabled={saving} onClick={() => void action({ action: "support.update", ticketId: ticketThread.ticket.id, status: "waiting_admin", priority: "urgent" }, "Support ticket marked urgent.").then(() => openTicket(text(ticketThread.ticket.id)))} className="rounded-lg border border-rose-200/20 bg-rose-200/10 px-3 py-2 text-[10px] font-black text-rose-100">Mark urgent</button></div>
            <div className="mt-4 max-h-[50vh] space-y-3 overflow-y-auto">
              {ticketThread.messages.map((message) => <div key={message.id} className={`rounded-2xl border p-3 ${message.sender_role === "admin" ? "ml-6 border-emerald-200/20 bg-emerald-200/[.05]" : "mr-6 border-white/10 bg-black/20"}`}><div className="text-[10px] font-black uppercase text-white/35">{message.sender_role} · {dateLabel(message.created_at)}</div><p className="mt-2 whitespace-pre-wrap text-sm font-semibold leading-6 text-white/70">{text(message.body)}</p></div>)}
              {ticketThread.attachments.map((attachment) => attachment.signedUrl ? <a key={attachment.id} href={attachment.signedUrl} target="_blank" rel="noreferrer" className="block rounded-xl border border-cyan-200/15 p-3 text-xs font-black text-cyan-100">Open attachment: {attachment.file_name}</a> : null)}
            </div>
            <form onSubmit={replyTicket} className="mt-4"><textarea required minLength={1} maxLength={4000} value={ticketReply} onChange={(event) => setTicketReply(event.target.value)} rows={4} className="w-full rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-white" placeholder="Reply to the player…" /><button disabled={saving || !ticketReply.trim()} className="mt-2 min-h-11 w-full rounded-xl bg-emerald-300 px-3 text-xs font-black text-emerald-950 disabled:opacity-40">Send reply</button></form>
          </div>
        </div>
      ) : null}
    </main>
  );
}
