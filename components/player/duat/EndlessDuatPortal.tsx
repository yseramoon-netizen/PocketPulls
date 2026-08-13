"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { supabase } from "@/lib/supabase";
import EndlessDuatGame, { type DuatBootstrap } from "@/components/player/duat/EndlessDuatGame";
import DuatConstellationBackdrop from "@/components/player/duat/DuatConstellationBackdrop";

export default function EndlessDuatPortal() {
  const router = useRouter();
  const [bootstrap, setBootstrap] = useState<DuatBootstrap | null>(null);
  const [accessToken, setAccessToken] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        if (!token) throw new Error("Your Ancient Pulls session has expired.");
        const response = await fetch("/api/player/duat/bootstrap", {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "The Duat gate would not open.");
        const ownedSkins = Array.isArray(payload.ownedSkins) ? payload.ownedSkins : ["midnight"];
        const localSkin = window.localStorage.getItem("pocketpulls:nebu-skin-v1");
        if (localSkin && ownedSkins.includes(localSkin)) payload.selectedSkin = localSkin;
        if (!cancelled) {
          setAccessToken(token);
          setBootstrap(payload as DuatBootstrap);
        }
      } catch (caught) {
        if (!cancelled) setError(caught instanceof Error ? caught.message : "The Duat gate would not open.");
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    document.documentElement.dataset.duatOpen = "true";
    return () => { delete document.documentElement.dataset.duatOpen; };
  }, []);

  const exit = () => router.push("/hq");
  const openBadges = () => router.push("/achievements");

  return (
    <div className="endless-duat-portal">
      {bootstrap && accessToken ? (
        <>
          <DuatConstellationBackdrop constellation={bootstrap.constellation} />
          <EndlessDuatGame bootstrap={bootstrap} accessToken={accessToken} onExit={exit} onOpenBadges={openBadges} />
        </>
      ) : (
        <main className="duat-gate">
          <div className="duat-gate-star">✦</div>
          <span>ANCIENT PULLS</span>
          <h1>{error ? "The gate is resting" : "Opening the Endless Duat…"}</h1>
          <p>{error || "Nebu is gathering your wardrobe, relics and constellation."}</p>
          {error && <button onClick={exit}>Return to HQ</button>}
        </main>
      )}
    </div>
  );
}
