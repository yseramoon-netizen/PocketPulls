"use client";

import {
  type ImgHTMLAttributes,
  useEffect,
  useState,
} from "react";

import { adminFetchBlob } from "@/lib/admin/client-auth";
import type { ShayminMoodKey } from "@/lib/admin/shaymin-care";

type ProtectedShayminImageProps = Omit<
  ImgHTMLAttributes<HTMLImageElement>,
  "src"
> & {
  mood: ShayminMoodKey;
};

const objectUrlCache = new Map<ShayminMoodKey, string>();
const pendingCache = new Map<ShayminMoodKey, Promise<string>>();

async function loadMoodImage(mood: ShayminMoodKey): Promise<string> {
  const cached = objectUrlCache.get(mood);
  if (cached) return cached;

  const pending = pendingCache.get(mood);
  if (pending) return pending;

  const request = adminFetchBlob(`/api/admin/shaymin-art/${encodeURIComponent(mood)}`)
    .then((blob) => {
      const url = URL.createObjectURL(blob);
      objectUrlCache.set(mood, url);
      pendingCache.delete(mood);
      return url;
    })
    .catch((error) => {
      pendingCache.delete(mood);
      throw error;
    });

  pendingCache.set(mood, request);
  return request;
}

export default function ProtectedShayminImage({
  mood,
  alt = "",
  ...props
}: ProtectedShayminImageProps) {
  const [src, setSrc] = useState<string | null>(() => objectUrlCache.get(mood) ?? null);

  useEffect(() => {
    let active = true;
    const cached = objectUrlCache.get(mood);

    if (cached) {
      setSrc(cached);
      return () => {
        active = false;
      };
    }

    setSrc(null);
    void loadMoodImage(mood).then((url) => {
      if (active) setSrc(url);
    }).catch(() => {
      if (active) setSrc(null);
    });

    return () => {
      active = false;
    };
  }, [mood]);

  if (!src) {
    return <span aria-hidden="true" className={props.className} />;
  }

  return <img {...props} src={src} alt={alt} draggable={false} />;
}
