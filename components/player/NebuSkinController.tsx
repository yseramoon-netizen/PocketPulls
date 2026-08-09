"use client";

import { useEffect } from "react";

import {
  applyNebuSkin,
  isNebuSkinKey,
  NEBU_SKIN_CHANGE_EVENT,
  NEBU_SKIN_STORAGE_KEY,
  readNebuSkin,
} from "@/lib/player/nebu";

export default function NebuSkinController() {
  useEffect(() => {
    applyNebuSkin(readNebuSkin(), { persist: false, announce: false });

    const handleStorage = (event: StorageEvent) => {
      if (
        event.key === NEBU_SKIN_STORAGE_KEY &&
        isNebuSkinKey(event.newValue)
      ) {
        applyNebuSkin(event.newValue, { persist: false, announce: false });
      }
    };

    const handleSkinChange = (event: Event) => {
      const key = (event as CustomEvent<{ key?: unknown }>).detail?.key;

      if (isNebuSkinKey(key)) {
        document.documentElement.dataset.nebuSkin = key;
      }
    };

    window.addEventListener("storage", handleStorage);
    window.addEventListener(NEBU_SKIN_CHANGE_EVENT, handleSkinChange);

    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener(NEBU_SKIN_CHANGE_EVENT, handleSkinChange);
    };
  }, []);

  return null;
}
