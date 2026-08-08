"use client";

import { usePathname, useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

import { supabase } from "@/lib/supabase";

type NotificationRow = {
  notification_key: string;
  kind: string;
  title: string;
  body: string;
  href: string | null;
  glyph: string;
  created_at: string;
  read_at: string | null;
  priority: number;
};

const REFRESH_EVENTS = [
  "pocketpulls:reward-claimed",
  "pocketpulls:achievement-reward-claimed",
  "pocketpulls:profile-updated",
  "pocketpulls:friendship-updated",
  "pocketpulls:trade-updated",
  "pocketpulls:shipping-updated",
  "pocketpulls:wish-balance",
] as const;

function asNotificationRows(value: unknown): NotificationRow[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    if (typeof item !== "object" || item === null) {
      return [];
    }

    const row = item as Record<string, unknown>;

    if (
      typeof row.notification_key !== "string" ||
      typeof row.title !== "string" ||
      typeof row.body !== "string"
    ) {
      return [];
    }

    return [
      {
        notification_key: row.notification_key,
        kind: typeof row.kind === "string" ? row.kind : "update",
        title: row.title,
        body: row.body,
        href:
          typeof row.href === "string" && row.href.startsWith("/")
            ? row.href
            : null,
        glyph:
          typeof row.glyph === "string" && row.glyph.trim()
            ? row.glyph
            : "✦",
        created_at:
          typeof row.created_at === "string"
            ? row.created_at
            : new Date().toISOString(),
        read_at: typeof row.read_at === "string" ? row.read_at : null,
        priority: Number.isFinite(Number(row.priority))
          ? Number(row.priority)
          : 0,
      },
    ];
  });
}

function formatRelativeTime(value: string): string {
  const timestamp = new Date(value).getTime();

  if (!Number.isFinite(timestamp)) {
    return "Recently";
  }

  const differenceSeconds = Math.round((timestamp - Date.now()) / 1000);
  const absoluteSeconds = Math.abs(differenceSeconds);
  const formatter = new Intl.RelativeTimeFormat("en-GB", {
    numeric: "auto",
  });

  if (absoluteSeconds < 60) {
    return "Just now";
  }

  if (absoluteSeconds < 3600) {
    return formatter.format(Math.round(differenceSeconds / 60), "minute");
  }

  if (absoluteSeconds < 86400) {
    return formatter.format(Math.round(differenceSeconds / 3600), "hour");
  }

  if (absoluteSeconds < 604800) {
    return formatter.format(Math.round(differenceSeconds / 86400), "day");
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
  }).format(new Date(timestamp));
}

function notificationTone(kind: string): string {
  switch (kind) {
    case "friend":
      return "border-cyan-200/25 bg-cyan-200/[0.08] text-cyan-50";
    case "trade":
      return "border-violet-200/25 bg-violet-200/[0.09] text-violet-50";
    case "achievement":
    case "reward":
      return "border-yellow-100/25 bg-yellow-200/[0.09] text-yellow-50";
    case "shipping":
      return "border-emerald-200/25 bg-emerald-200/[0.08] text-emerald-50";
    default:
      return "border-pink-200/25 bg-pink-200/[0.08] text-pink-50";
  }
}

export default function NotificationCentre() {
  const router = useRouter();
  const pathname = usePathname();
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const requestRef = useRef(0);

  const [mounted, setMounted] = useState(false);
  const [available, setAvailable] = useState(true);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [markingAll, setMarkingAll] = useState(false);
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);

  const unreadCount = useMemo(
    () => notifications.filter((notification) => !notification.read_at).length,
    [notifications],
  );

  const loadNotifications = useCallback(async (quiet = false) => {
    const requestId = requestRef.current + 1;
    requestRef.current = requestId;

    if (!quiet) {
      setLoading(true);
    }

    const { data, error } = await supabase.rpc("get_player_notifications", {
      p_limit: 40,
    });

    if (requestRef.current !== requestId) {
      return;
    }

    if (error) {
      console.warn("Notification centre is unavailable:", error.message);
      setAvailable(false);
      setLoading(false);
      return;
    }

    setAvailable(true);
    setNotifications(asNotificationRows(data));
    setLoading(false);
  }, []);

  useEffect(() => {
    setMounted(true);
    void loadNotifications();

    const refresh = () => {
      void loadNotifications(true);
    };

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        refresh();
      }
    };

    const interval = window.setInterval(refresh, 40000);

    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", handleVisibility);
    REFRESH_EVENTS.forEach((eventName) => {
      window.addEventListener(eventName, refresh);
    });

    return () => {
      requestRef.current += 1;
      window.clearInterval(interval);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", handleVisibility);
      REFRESH_EVENTS.forEach((eventName) => {
        window.removeEventListener(eventName, refresh);
      });
    };
  }, [loadNotifications]);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) {
      return;
    }

    void loadNotifications(true);

    const frame = window.requestAnimationFrame(() => {
      closeButtonRef.current?.focus();
    });

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [loadNotifications, open]);

  const markRead = useCallback((notificationKey: string) => {
    setNotifications((current) =>
      current.map((notification) =>
        notification.notification_key === notificationKey
          ? { ...notification, read_at: new Date().toISOString() }
          : notification,
      ),
    );

    void supabase
      .rpc("mark_player_notification_read", {
        p_notification_key: notificationKey,
      })
      .then(({ error }) => {
        if (error) {
          console.warn("Notification could not be marked as read:", error.message);
          void loadNotifications(true);
        }
      });
  }, [loadNotifications]);

  const markAllRead = useCallback(async () => {
    if (markingAll || unreadCount === 0) {
      return;
    }

    setMarkingAll(true);
    const markedAt = new Date().toISOString();
    const previous = notifications;

    setNotifications((current) =>
      current.map((notification) => ({
        ...notification,
        read_at: notification.read_at || markedAt,
      })),
    );

    const { error } = await supabase.rpc("mark_player_notification_read", {
      p_notification_key: null,
    });

    if (error) {
      console.warn("Notifications could not be marked as read:", error.message);
      setNotifications(previous);
    }

    setMarkingAll(false);
  }, [markingAll, notifications, unreadCount]);

  if (!available) {
    return null;
  }

  const panel = open ? (
    <div className="fixed inset-0 z-[160]" aria-hidden={false}>
      <button
        type="button"
        aria-label="Close notifications"
        onClick={() => setOpen(false)}
        className="absolute inset-0 cursor-default bg-[#02030d]/72 backdrop-blur-sm"
      />

      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="notification-centre-title"
        className="absolute inset-x-3 top-20 mx-auto flex max-h-[calc(100dvh-6rem)] w-auto max-w-md flex-col overflow-hidden rounded-[1.75rem] border border-cyan-100/20 bg-[#080a24]/98 shadow-[0_35px_120px_rgba(0,0,0,0.72)] backdrop-blur-3xl sm:inset-x-auto sm:right-5 sm:w-[27rem]"
      >
        <div className="h-1 flex-none bg-gradient-to-r from-cyan-200 via-yellow-100 to-violet-300" />

        <header className="flex flex-none items-start gap-4 border-b border-white/10 px-5 py-5">
          <div className="flex h-11 w-11 flex-none items-center justify-center rounded-2xl border border-yellow-100/20 bg-yellow-200/[0.08] text-xl text-yellow-50 shadow-[0_0_30px_rgba(250,204,21,0.08)]">
            ✦
          </div>

          <div className="min-w-0 flex-1">
            <p className="text-[0.62rem] font-black uppercase tracking-[0.2em] text-cyan-100/45">
              Trainer signals
            </p>
            <h2
              id="notification-centre-title"
              className="mt-1 text-xl font-black text-white"
            >
              Notifications
            </h2>
            <p className="mt-1 text-xs font-bold text-white/40">
              {unreadCount > 0
                ? `${unreadCount} unread ${unreadCount === 1 ? "message" : "messages"}`
                : "You are all caught up"}
            </p>
          </div>

          <button
            ref={closeButtonRef}
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close notifications"
            className="flex h-10 w-10 flex-none items-center justify-center rounded-xl border border-white/10 bg-white/[0.05] text-lg font-black text-white/70 transition hover:bg-white/[0.1] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200"
          >
            ×
          </button>
        </header>

        <div className="flex items-center justify-between gap-3 border-b border-white/[0.07] px-5 py-3">
          <p className="text-[0.62rem] font-black uppercase tracking-[0.16em] text-white/32">
            Latest activity
          </p>

          <button
            type="button"
            disabled={unreadCount === 0 || markingAll}
            onClick={() => void markAllRead()}
            className="rounded-lg px-2.5 py-1.5 text-xs font-black text-cyan-100 transition hover:bg-cyan-200/[0.08] disabled:cursor-default disabled:text-white/22"
          >
            {markingAll ? "Marking…" : "Mark all read"}
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          {loading && notifications.length === 0 ? (
            <div className="flex min-h-52 flex-col items-center justify-center px-6 text-center">
              <span className="animate-pulse text-4xl text-yellow-100/55">✦</span>
              <p className="mt-4 text-sm font-black text-white/65">
                Reading the stars…
              </p>
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex min-h-52 flex-col items-center justify-center px-6 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full border border-violet-200/15 bg-violet-200/[0.06] text-2xl text-violet-100/55">
                ✧
              </div>
              <p className="mt-4 text-base font-black text-white">
                The sky is quiet
              </p>
              <p className="mt-2 max-w-xs text-sm font-semibold leading-6 text-white/38">
                Friend requests, rewards, trades and delivery updates will appear
                here.
              </p>
            </div>
          ) : (
            <ul className="space-y-2">
              {notifications.map((notification) => {
                const unread = !notification.read_at;
                const interactive = Boolean(notification.href);

                return (
                  <li key={notification.notification_key}>
                    <button
                      type="button"
                      onClick={() => {
                        if (unread) {
                          markRead(notification.notification_key);
                        }

                        if (notification.href) {
                          setOpen(false);
                          router.push(notification.href);
                        }
                      }}
                      className={[
                        "group relative flex w-full gap-3 rounded-2xl border p-3.5 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200",
                        unread
                          ? "border-cyan-100/18 bg-white/[0.065] shadow-[inset_3px_0_0_rgba(103,232,249,0.62)] hover:bg-white/[0.09]"
                          : "border-white/[0.07] bg-white/[0.025] opacity-75 hover:opacity-100",
                        interactive ? "cursor-pointer" : "cursor-default",
                      ].join(" ")}
                    >
                      <span
                        className={[
                          "flex h-11 w-11 flex-none items-center justify-center rounded-2xl border text-lg font-black",
                          notificationTone(notification.kind),
                        ].join(" ")}
                      >
                        {notification.glyph}
                      </span>

                      <span className="min-w-0 flex-1">
                        <span className="flex items-start gap-2">
                          <span className="min-w-0 flex-1 text-sm font-black leading-5 text-white">
                            {notification.title}
                          </span>
                          {unread ? (
                            <span className="mt-1.5 h-2 w-2 flex-none rounded-full bg-cyan-200 shadow-[0_0_12px_rgba(103,232,249,0.85)]" />
                          ) : null}
                        </span>

                        <span className="mt-1 block text-xs font-semibold leading-5 text-white/46">
                          {notification.body}
                        </span>

                        <span className="mt-2 flex items-center gap-2 text-[0.62rem] font-black uppercase tracking-[0.1em] text-white/28">
                          {formatRelativeTime(notification.created_at)}
                          {interactive ? (
                            <span className="text-cyan-100/55 transition group-hover:translate-x-0.5">
                              Open →
                            </span>
                          ) : null}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>
    </div>
  ) : null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={
          unreadCount > 0
            ? `Open notifications, ${unreadCount} unread`
            : "Open notifications"
        }
        aria-expanded={open}
        title="Notifications"
        className="relative flex h-11 w-11 flex-none items-center justify-center rounded-xl border border-cyan-100/15 bg-cyan-200/[0.055] text-lg text-cyan-50 transition hover:border-cyan-100/25 hover:bg-cyan-200/[0.1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200"
      >
        <span aria-hidden="true">✧</span>

        {unreadCount > 0 ? (
          <span className="absolute -right-1.5 -top-1.5 flex min-h-5 min-w-5 items-center justify-center rounded-full border-2 border-[#080a24] bg-pink-400 px-1 text-[0.58rem] font-black leading-none text-white shadow-[0_0_15px_rgba(244,114,182,0.65)]">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        ) : null}
      </button>

      {mounted && panel ? createPortal(panel, document.body) : null}
    </>
  );
}
