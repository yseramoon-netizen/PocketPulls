"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import useModalFocus from "@/lib/client/useModalFocus";
import { searchPlayerRoutes } from "@/lib/player/routes";

export default function QuickNavigation() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const id = useId();
  const cinematicRef = useRef(false);
  const panelRef = useModalFocus<HTMLDivElement>(open, () => setOpen(false));
  const routes = searchPlayerRoutes(query);
  const selected = Math.min(active, Math.max(0, routes.length - 1));
  const show = useCallback(() => { if (cinematicRef.current) return; setQuery(""); setActive(0); setOpen(true); }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k" && !event.isComposing) {
        if (cinematicRef.current) return;
        event.preventDefault();
        setQuery(""); setActive(0); setOpen((current) => !current);
      }
    };
    const onCinematic = (event: Event) => {
      cinematicRef.current = Boolean((event as CustomEvent<{ open?: boolean }>).detail?.open);
      if (cinematicRef.current) setOpen(false);
    };
    window.addEventListener("pocketpulls:wish-cinematic-visibility", onCinematic);
    window.addEventListener("keydown", onKey);
    window.addEventListener("ancientpulls:quick-navigation", show);
    return () => {
      window.removeEventListener("pocketpulls:wish-cinematic-visibility", onCinematic);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("ancientpulls:quick-navigation", show);
    };
  }, [show]);
  useEffect(() => {
    if (open) document.getElementById(`${id}-${selected}`)?.scrollIntoView({ block: "nearest" });
  }, [id, open, selected]);

  const navigate = (href: string) => { setOpen(false); router.push(href); };

  return <>
    <button type="button" onClick={show} aria-label="Search pages" aria-keyshortcuts="Control+k Meta+k" title="Search pages (Ctrl / ⌘ K)" className="hidden h-11 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 text-xs font-semibold text-white/60 transition hover:bg-white/[0.08] hover:text-white sm:inline-flex">
      <span aria-hidden="true">⌕</span><span className="hidden lg:inline">Search</span><kbd className="hidden text-[10px] text-white/30 2xl:inline">⌘ K</kbd>
    </button>
    {open ? createPortal(
      <div className="fixed inset-0 z-[10020] flex items-start justify-center bg-[#02030d]/80 px-3 pt-[max(4rem,12dvh)] backdrop-blur-md" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
        <div ref={panelRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby={`${id}-title`} className="flex max-h-[72dvh] w-full max-w-xl flex-col overflow-hidden rounded-3xl border border-white/15 bg-[#0a0d20] text-white shadow-[0_32px_100px_#0009]">
          <div className="flex items-center gap-3 border-b border-white/10 px-5 py-4">
            <label id={`${id}-title`} htmlFor={`${id}-input`} className="sr-only">Go to a page</label>
            <span aria-hidden="true" className="text-xl text-cyan-100/60">⌕</span>
            <input id={`${id}-input`} data-autofocus type="search" value={query} onChange={(event) => { setQuery(event.target.value); setActive(0); }} placeholder="Where would you like to go?" autoComplete="off" role="combobox" aria-expanded="true" aria-controls={`${id}-results`} aria-autocomplete="list" aria-activedescendant={routes.length ? `${id}-${selected}` : undefined} className="min-w-0 flex-1 bg-transparent py-2 text-base outline-none placeholder:text-white/30" onKeyDown={(event) => {
              if (event.key === "ArrowDown") { event.preventDefault(); setActive((current) => (current + 1) % Math.max(1, routes.length)); }
              if (event.key === "ArrowUp") { event.preventDefault(); setActive((current) => (current - 1 + routes.length) % Math.max(1, routes.length)); }
              if (event.key === "Enter" && routes[selected]) { event.preventDefault(); navigate(routes[selected].href); }
            }} />
            <button type="button" onClick={() => setOpen(false)} aria-label="Close search" className="grid h-11 w-11 place-items-center rounded-xl text-xl text-white/50 hover:bg-white/5">×</button>
          </div>
          <div id={`${id}-results`} role="listbox" aria-label="Pages" className="min-h-0 overflow-y-auto overscroll-contain p-2">
            {routes.map((route, index) => <button key={route.href} id={`${id}-${index}`} type="button" role="option" aria-selected={index === selected} tabIndex={-1} onClick={() => navigate(route.href)} onMouseMove={() => setActive(index)} className={`flex min-h-16 w-full items-center gap-4 rounded-2xl px-4 py-3 text-left transition ${index === selected ? "bg-cyan-100/[0.08]" : "hover:bg-white/[0.04]"}`}>
              <span aria-hidden="true" className="w-7 text-center text-xl text-cyan-100/70">{route.glyph}</span>
              <span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{route.label}</span><span className="mt-1 block text-xs text-white/40">{route.detail}</span></span>
              <span aria-hidden="true" className="text-white/25">↵</span>
            </button>)}
            {!routes.length ? <p role="status" className="px-5 py-10 text-center text-sm text-white/50">No pages match “{query}”. Try “binder”, “shipping” or “help”.</p> : null}
          </div>
          <div className="border-t border-white/10 px-5 py-3 text-[11px] text-white/35">↑ ↓ to move · Enter to open · Esc to close</div>
        </div>
      </div>, document.body,
    ) : null}
  </>;
}
