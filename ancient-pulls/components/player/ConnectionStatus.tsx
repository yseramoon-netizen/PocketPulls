"use client";
import { useSyncExternalStore } from "react";
function subscribe(notify: () => void) {
  window.addEventListener("online", notify);
  window.addEventListener("offline", notify);
  return () => { window.removeEventListener("online", notify); window.removeEventListener("offline", notify); };
}
export default function ConnectionStatus() {
  const online = useSyncExternalStore(subscribe, () => navigator.onLine, () => true);
  if (online) return null;
  return <div role="status" className="border-b border-amber-100/15 bg-[#231d17] px-4 py-3 text-center text-sm text-amber-100">
    You’re offline. Reconnect before making a wish or saving changes.
  </div>;
}
