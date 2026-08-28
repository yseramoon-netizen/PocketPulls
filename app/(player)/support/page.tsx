"use client";

import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";

import {
  PlayerErrorBanner,
  PlayerPageHeader,
  PlayerPanel,
  PlayerPrimaryButton,
} from "@/components/player/PlayerUI";
import { supabase } from "@/lib/supabase";

type Ticket = {
  id: string;
  ticket_number: number | string;
  category: string;
  subject: string;
  status: string;
  priority: string;
  last_message_at: string;
  created_at: string;
};

type Message = {
  id: string;
  ticket_id: string;
  sender_role: string;
  body: string;
  created_at: string;
};

type Attachment = {
  id: string;
  ticket_id: string;
  message_id: string;
  file_name: string;
  storage_path: string;
  signedUrl?: string | null;
};

const CATEGORIES = [
  ["wrong_card", "Wrong card"],
  ["payment", "Payment"],
  ["shipping", "Shipping"],
  ["damaged", "Damaged card"],
  ["missing", "Missing card"],
  ["account", "Account"],
  ["other", "Other"],
] as const;

function errorText(error: unknown): string {
  if (error instanceof Error && error.message.trim()) return error.message.trim();
  if (typeof error === "object" && error !== null && "message" in error) {
    const value = (error as { message?: unknown }).message;
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "Support could not complete that request.";
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleString("en-GB");
}

function statusLabel(status: string): string {
  return ({
    open: "Open",
    waiting_admin: "Waiting for Ancient Pulls",
    waiting_player: "Waiting for you",
    resolved: "Resolved",
    closed: "Closed",
  } as Record<string, string>)[status] || status;
}

export default function SupportPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [category, setCategory] = useState("wrong_card");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [reply, setReply] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);

  const selected = useMemo(
    () => tickets.find((ticket) => ticket.id === selectedId) || null,
    [selectedId, tickets],
  );

  const loadTickets = useCallback(async () => {
    setLoading(true);
    try {
      const result = await supabase
        .from("support_tickets")
        .select("id,ticket_number,category,subject,status,priority,last_message_at,created_at")
        .order("last_message_at", { ascending: false });
      if (result.error) throw result.error;
      setTickets((result.data || []) as Ticket[]);
    } catch (caught) {
      setError(errorText(caught));
    } finally {
      setLoading(false);
    }
  }, []);

  const loadThread = useCallback(async (ticketId: string) => {
    setBusy(true);
    setError(null);
    try {
      const [messageResult, attachmentResult] = await Promise.all([
        supabase.from("support_messages")
          .select("id,ticket_id,sender_role,body,created_at")
          .eq("ticket_id", ticketId)
          .order("created_at", { ascending: true }),
        supabase.from("support_attachments")
          .select("id,ticket_id,message_id,file_name,storage_path")
          .eq("ticket_id", ticketId)
          .order("created_at", { ascending: true }),
      ]);
      if (messageResult.error) throw messageResult.error;
      if (attachmentResult.error) throw attachmentResult.error;

      const signedAttachments = await Promise.all(
        ((attachmentResult.data || []) as Attachment[]).map(async (attachment) => {
          const signed = await supabase.storage
            .from("support-attachments")
            .createSignedUrl(attachment.storage_path, 15 * 60);
          return { ...attachment, signedUrl: signed.data?.signedUrl || null };
        }),
      );

      setSelectedId(ticketId);
      setMessages((messageResult.data || []) as Message[]);
      setAttachments(signedAttachments);
      await supabase.rpc("mark_player_support_ticket_read", { p_ticket_id: ticketId });
    } catch (caught) {
      setError(errorText(caught));
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => { void loadTickets(); });
    return () => window.cancelAnimationFrame(frame);
  }, [loadTickets]);

  async function uploadPhoto(ticketId: string, messageId: string, file: File) {
    if (!new Set(["image/jpeg", "image/png", "image/webp"]).has(file.type)) {
      throw new Error("Attach a JPEG, PNG or WebP image.");
    }
    if (file.size < 1 || file.size > 8 * 1024 * 1024) {
      throw new Error("Support photos must be smaller than 8 MB.");
    }

    const userResult = await supabase.auth.getUser();
    if (userResult.error || !userResult.data.user) throw new Error("Sign in again before attaching a photo.");
    const extension = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
    const path = `${userResult.data.user.id}/${ticketId}/${messageId}-${crypto.randomUUID()}.${extension}`;
    const upload = await supabase.storage.from("support-attachments").upload(path, file, {
      contentType: file.type,
      upsert: false,
    });
    if (upload.error) throw upload.error;

    const record = await supabase.from("support_attachments").insert({
      ticket_id: ticketId,
      message_id: messageId,
      user_id: userResult.data.user.id,
      storage_path: path,
      file_name: file.name.slice(0, 240) || `support-photo.${extension}`,
      content_type: file.type,
      size_bytes: file.size,
    });
    if (record.error) {
      await supabase.storage.from("support-attachments").remove([path]);
      throw record.error;
    }
  }

  async function createTicket(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const result = await supabase.rpc("create_player_support_ticket", {
        p_category: category,
        p_subject: subject,
        p_body: body,
        p_related_wish_id: null,
        p_related_order_id: null,
        p_related_shipment_id: null,
      });
      if (result.error) throw result.error;
      const row = Array.isArray(result.data) ? result.data[0] : result.data;
      if (!row?.ticket_id || !row?.message_id) throw new Error("The ticket was created without a thread.");
      if (photo) await uploadPhoto(String(row.ticket_id), String(row.message_id), photo);

      setSubject("");
      setBody("");
      setPhoto(null);
      setCreating(false);
      setNotice(`Support ticket #${row.ticket_number} opened.`);
      await loadTickets();
      await loadThread(String(row.ticket_id));
    } catch (caught) {
      setError(errorText(caught));
    } finally {
      setBusy(false);
    }
  }

  async function sendReply(event: FormEvent) {
    event.preventDefault();
    if (!selected || !reply.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await supabase.rpc("reply_player_support_ticket", {
        p_ticket_id: selected.id,
        p_body: reply,
      });
      if (result.error) throw result.error;
      const messageId = String(result.data);
      if (photo) await uploadPhoto(selected.id, messageId, photo);
      setReply("");
      setPhoto(null);
      setNotice("Your reply was added.");
      await loadTickets();
      await loadThread(selected.id);
    } catch (caught) {
      setError(errorText(caught));
    } finally {
      setBusy(false);
    }
  }

  const threadAttachments = (messageId: string) => attachments.filter((item) => item.message_id === messageId);

  return (
    <div className="mx-auto w-full max-w-[1180px] px-4 py-7 sm:px-6 lg:px-8 lg:py-10">
      <PlayerPageHeader eyebrow="Player care" title="Support" description="Report a wrong card, payment, shipping or condition problem with a private photo and a permanent message history." />

      {error ? <div className="mt-4"><PlayerErrorBanner message={error} /></div> : null}
      {notice ? <div className="mt-4 rounded-2xl border border-emerald-200/15 bg-emerald-200/[.06] p-4 text-sm font-bold text-emerald-50/75">{notice}</div> : null}

      <div className="mt-5 grid gap-5 lg:grid-cols-[22rem_minmax(0,1fr)]">
        <PlayerPanel>
          <div className="flex items-center justify-between gap-3"><div><h2 className="text-lg font-black">Your tickets</h2><p className="mt-1 text-xs font-semibold text-white/38">Replies stay attached to your account.</p></div><button type="button" onClick={() => { setCreating(true); setSelectedId(null); }} className="rounded-xl bg-cyan-100 px-3 py-2 text-xs font-black text-[#08152d]">New</button></div>
          <div className="mt-4 space-y-2">
            {tickets.map((ticket) => <button key={ticket.id} type="button" onClick={() => void loadThread(ticket.id)} className={`w-full rounded-xl border p-3 text-left ${selectedId === ticket.id ? "border-cyan-200/30 bg-cyan-200/[.07]" : "border-white/10 bg-black/15"}`}><div className="flex gap-2"><span className="min-w-0 flex-1 truncate text-sm font-black">#{ticket.ticket_number} {ticket.subject}</span><span className="text-[9px] font-black uppercase text-cyan-100/55">{statusLabel(ticket.status)}</span></div><div className="mt-1 text-[10px] text-white/35">{formatDate(ticket.last_message_at)}</div></button>)}
            {!loading && !tickets.length ? <p className="py-8 text-center text-sm font-semibold text-white/35">No support tickets yet.</p> : null}
            {loading ? <p className="py-8 text-center text-sm font-black text-white/35">Loading…</p> : null}
          </div>
        </PlayerPanel>

        <PlayerPanel>
          {creating ? (
            <form onSubmit={createTicket} className="space-y-4">
              <div><h2 className="text-xl font-black">Tell us what happened</h2><p className="mt-1 text-xs font-semibold text-white/40">Never include passwords or payment-card details.</p></div>
              <label className="block text-xs font-black text-white/60">Problem type<select value={category} onChange={(event) => setCategory(event.target.value)} className="mt-1.5 min-h-12 w-full rounded-xl border border-white/10 bg-[#0a0d2b] px-3 text-white">{CATEGORIES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
              <label className="block text-xs font-black text-white/60">Subject<input required minLength={5} maxLength={120} value={subject} onChange={(event) => setSubject(event.target.value)} className="mt-1.5 min-h-12 w-full rounded-xl border border-white/10 bg-black/20 px-3 text-white" /></label>
              <label className="block text-xs font-black text-white/60">What happened?<textarea required minLength={10} maxLength={4000} rows={6} value={body} onChange={(event) => setBody(event.target.value)} className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/20 p-3 text-white" /></label>
              <label className="block text-xs font-black text-white/60">Photo (optional)<input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setPhoto(event.target.files?.[0] || null)} className="mt-1.5 block w-full text-xs text-white/45 file:mr-3 file:rounded-lg file:border-0 file:bg-white/10 file:px-3 file:py-2 file:text-white" /></label>
              <div className="grid grid-cols-2 gap-2"><button type="button" onClick={() => setCreating(false)} className="min-h-12 rounded-xl border border-white/10 text-xs font-black text-white/55">Cancel</button><PlayerPrimaryButton type="submit" disabled={busy}>{busy ? "Sending…" : "Open ticket"}</PlayerPrimaryButton></div>
            </form>
          ) : selected ? (
            <div>
              <div className="flex flex-wrap items-start justify-between gap-3"><div><div className="text-xs font-black text-cyan-100/55">Ticket #{selected.ticket_number}</div><h2 className="mt-1 text-xl font-black">{selected.subject}</h2></div><span className="rounded-full border border-cyan-100/15 bg-cyan-100/[.05] px-3 py-1 text-[10px] font-black text-cyan-50/65">{statusLabel(selected.status)}</span></div>
              <div className="mt-5 max-h-[50vh] space-y-3 overflow-y-auto pr-1">
                {messages.map((message) => <div key={message.id} className={`rounded-2xl border p-4 ${message.sender_role === "player" ? "ml-5 border-violet-200/15 bg-violet-200/[.05]" : "mr-5 border-cyan-200/15 bg-cyan-200/[.05]"}`}><div className="text-[10px] font-black uppercase tracking-wide text-white/35">{message.sender_role === "player" ? "You" : "Ancient Pulls"} · {formatDate(message.created_at)}</div><p className="mt-2 whitespace-pre-wrap text-sm font-semibold leading-6 text-white/70">{message.body}</p>{threadAttachments(message.id).map((attachment) => attachment.signedUrl ? <a key={attachment.id} href={attachment.signedUrl} target="_blank" rel="noreferrer" className="mt-3 block rounded-xl border border-white/10 p-2 text-xs font-black text-cyan-100">View {attachment.file_name}</a> : null)}</div>)}
              </div>
              {selected.status !== "closed" ? <form onSubmit={sendReply} className="mt-4 space-y-3"><textarea required maxLength={4000} rows={4} value={reply} onChange={(event) => setReply(event.target.value)} placeholder="Add a reply…" className="w-full rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-white" /><input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setPhoto(event.target.files?.[0] || null)} className="block w-full text-xs text-white/45" /><PlayerPrimaryButton type="submit" disabled={busy || !reply.trim()}>{busy ? "Sending…" : "Send reply"}</PlayerPrimaryButton></form> : null}
            </div>
          ) : <div className="grid min-h-72 place-items-center text-center"><div><div className="text-3xl">◇</div><h2 className="mt-3 text-lg font-black">Choose a ticket or open a new one</h2><p className="mt-2 text-sm font-semibold text-white/35">We keep the complete conversation here.</p></div></div>}
        </PlayerPanel>
      </div>
    </div>
  );
}
