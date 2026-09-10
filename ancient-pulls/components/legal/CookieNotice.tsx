"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const NOTICE_KEY = "ancient-pulls:cookie-notice:2026-09";

export default function CookieNotice() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      try {
        setVisible(window.localStorage.getItem(NOTICE_KEY) !== "seen");
      } catch {
        setVisible(true);
      }
    });

    return () => window.cancelAnimationFrame(frame);
  }, []);

  if (!visible) return null;

  function dismiss() {
    try {
      window.localStorage.setItem(NOTICE_KEY, "seen");
    } catch {
      // The notice can still be dismissed for this page view.
    }
    setVisible(false);
  }

  return (
    <aside
      aria-label="Cookie and browser-storage notice"
      className="fixed inset-x-3 bottom-3 z-[200] mx-auto max-w-3xl rounded-2xl border border-cyan-100/15 bg-[#080b20]/95 p-4 text-white shadow-[0_24px_90px_rgba(0,0,0,0.55)] backdrop-blur-2xl sm:bottom-5 sm:flex sm:items-center sm:gap-5 sm:p-5"
    >
      <div className="min-w-0 flex-1">
        <p className="text-xs font-black uppercase tracking-[0.15em] text-cyan-100/55">Essential storage only</p>
        <p className="mt-1.5 text-sm font-semibold leading-6 text-white/60">
          Ancient Pulls uses sign-in/security storage and settings you ask it to remember. Optional analytics and advertising trackers are currently off.{" "}
          <Link className="font-black text-cyan-100 underline decoration-cyan-100/30 underline-offset-2" href="/cookies">See every category</Link>.
        </p>
      </div>
      <button
        type="button"
        onClick={dismiss}
        className="mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-cyan-100 px-5 text-sm font-black text-[#08152d] transition hover:brightness-110 sm:mt-0 sm:w-auto"
      >
        Understood
      </button>
    </aside>
  );
}
