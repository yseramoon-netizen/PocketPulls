"use client";

import {
  type ComponentPropsWithoutRef,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  DEFAULT_NEBU_SKIN,
  getNebuHeatAssets,
  isNebuSkinKey,
  NEBU_SKIN_CHANGE_EVENT,
  NEBU_SKIN_STORAGE_KEY,
  readNebuSkin,
  type NebuSkinKey,
} from "@/lib/player/nebu";

type NebuPortraitProps = Omit<
  ComponentPropsWithoutRef<"img">,
  "src"
>;

export default function NebuPortrait(props: NebuPortraitProps) {
  const [skin, setSkin] = useState<NebuSkinKey>(DEFAULT_NEBU_SKIN);

  useEffect(() => {
    setSkin(readNebuSkin());

    const handleSkinChange = (event: Event) => {
      const key = (event as CustomEvent<{ key?: unknown }>).detail?.key;

      if (isNebuSkinKey(key)) {
        setSkin(key);
      }
    };

    const handleStorage = (event: StorageEvent) => {
      if (
        event.key === NEBU_SKIN_STORAGE_KEY &&
        isNebuSkinKey(event.newValue)
      ) {
        setSkin(event.newValue);
      }
    };

    window.addEventListener(NEBU_SKIN_CHANGE_EVENT, handleSkinChange);
    window.addEventListener("storage", handleStorage);

    return () => {
      window.removeEventListener(NEBU_SKIN_CHANGE_EVENT, handleSkinChange);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  const source = useMemo(() => getNebuHeatAssets(skin).portrait, [skin]);

  return <img {...props} src={source} />;
}
