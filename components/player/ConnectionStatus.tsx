"use client";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
function subscribe(notify: () => void) {
  window.addEventListener("online", notify); window.addEventListener("offline", notify);
  return () => { window.removeEventListener("online", notify); window.removeEventListener("offline", notify); };
}
export default function ConnectionStatus() {
  const online = useSyncExternalStore(subscribe, () => navigator.onLine, () => true);
  const wasOffline = useRef(false), [restored, setRestored] = useState(false);
  useEffect(() => {
    if (!online) { wasOffline.current = true; return; }
    if (!wasOffline.current) return;
    wasOffline.current = false;
    const frame = requestAnimationFrame(() => setRestored(true));
    const timer = setTimeout(() => setRestored(false), 5000);
    return () => { cancelAnimationFrame(frame); clearTimeout(timer); };
  }, [online]);
  if (online && !restored) return null;
  return <div role="status" className="as-network-status" data-online={online}>{online ? 'Connected again. Your stars are waiting.' : 'You’re offline. Reconnect before making a wish or saving changes.'}</div>;
}
