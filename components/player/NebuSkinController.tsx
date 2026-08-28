"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import {
  applyNebuSkin,
  isNebuSkinKey,
  NEBU_SKIN_CHANGE_EVENT,
  NEBU_SKIN_STORAGE_KEY,
  readNebuSkin,
} from "@/lib/player/nebu";
import {
  applyPlayerPreferences,
  readCachedPlayerPreferences,
} from "@/lib/player/preferences";

const COPY_SCOPE_SELECTOR = ".unknown-pulls-shell";
const COPY_ATTRIBUTES = ["alt", "aria-label", "title", "placeholder"] as const;

function mascotNameForSkin(skin: string | undefined): string | null {
  if (skin === "bubbles") return "Bubbles";
  if (skin === "cosmic_nebu") return "Cosmic Nebu";
  return null;
}

function preserveCaseName(match: string, name: string): string {
  if (match === match.toUpperCase()) return name.toUpperCase();
  if (match === match.toLowerCase()) return name.toLowerCase();
  return name;
}

function personaliseNebuName(value: string, name: string): string {
  return value.replace(/\bNebu\b/gi, (match) => preserveCaseName(match, name));
}

function containsNebu(value: string): boolean {
  return /\bnebu\b/i.test(value);
}

function containsMascotName(value: string, name: string): boolean {
  return value.toLowerCase().includes(name.toLowerCase());
}

function activatePersonalisedCopy(scope: Element, name: string): () => void {
  const originalText = new Map<Text, string>();
  const originalAttributes = new Map<Element, Map<string, string>>();
  const pendingNodes = new Set<Node>();
  let frame: number | null = null;

  const personaliseText = (node: Text) => {
    const parentTag = node.parentElement?.tagName;
    if (parentTag === "SCRIPT" || parentTag === "STYLE" || parentTag === "NOSCRIPT") return;

    const current = node.data;
    if (containsMascotName(current, name)) return;
    if (containsNebu(current)) {
      if (!originalText.has(node)) originalText.set(node, current);
      node.data = personaliseNebuName(current, name);
    } else if (originalText.has(node) && !containsMascotName(current, name)) {
      originalText.delete(node);
    }
  };

  const personaliseAttributes = (element: Element) => {
    let originals = originalAttributes.get(element);
    for (const attribute of COPY_ATTRIBUTES) {
      const current = element.getAttribute(attribute);
      if (current && containsMascotName(current, name)) continue;
      if (current && containsNebu(current)) {
        if (!originals) {
          originals = new Map<string, string>();
          originalAttributes.set(element, originals);
        }
        if (!originals.has(attribute)) originals.set(attribute, current);
        element.setAttribute(attribute, personaliseNebuName(current, name));
      } else if (originals?.has(attribute) && (!current || !containsMascotName(current, name))) {
        originals.delete(attribute);
      }
    }
    if (originals?.size === 0) originalAttributes.delete(element);
  };

  const personaliseTree = (root: Node) => {
    if (root.nodeType === Node.TEXT_NODE) {
      personaliseText(root as Text);
      return;
    }
    if (root.nodeType !== Node.ELEMENT_NODE) return;
    personaliseAttributes(root as Element);
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
    let node = walker.nextNode();
    while (node) {
      if (node.nodeType === Node.TEXT_NODE) personaliseText(node as Text);
      else personaliseAttributes(node as Element);
      node = walker.nextNode();
    }
  };

  const flush = () => {
    frame = null;
    for (const node of pendingNodes) personaliseTree(node);
    pendingNodes.clear();
  };

  personaliseTree(scope);
  const scopeObserver = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === "characterData" || mutation.type === "attributes") {
        pendingNodes.add(mutation.target);
      } else {
        for (const addedNode of mutation.addedNodes) pendingNodes.add(addedNode);
      }
    }
    if (pendingNodes.size && frame === null) frame = window.requestAnimationFrame(flush);
  });
  scopeObserver.observe(scope, {
    attributes: true,
    attributeFilter: [...COPY_ATTRIBUTES],
    characterData: true,
    childList: true,
    subtree: true,
  });

  return () => {
    scopeObserver.disconnect();
    if (frame !== null) window.cancelAnimationFrame(frame);
    pendingNodes.clear();
    for (const [node, value] of originalText) if (node.isConnected) node.data = value;
    for (const [element, attributes] of originalAttributes) {
      if (!element.isConnected) continue;
      for (const [attribute, value] of attributes) element.setAttribute(attribute, value);
    }
  };
}

export default function NebuSkinController() {
  const pathname = usePathname();
  const [personalisedName, setPersonalisedName] = useState<string | null>(null);

  useEffect(() => {
    const syncMascotName = () => {
      setPersonalisedName(
        mascotNameForSkin(document.documentElement.dataset.nebuSkin),
      );
    };

    const skinAttributeObserver = new MutationObserver(syncMascotName);
    skinAttributeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-nebu-skin"],
    });

    applyPlayerPreferences(readCachedPlayerPreferences());
    applyNebuSkin(readNebuSkin(), { persist: false, announce: false });
    syncMascotName();

    const handleStorage = (event: StorageEvent) => {
      if (event.key === NEBU_SKIN_STORAGE_KEY && isNebuSkinKey(event.newValue)) {
        applyNebuSkin(event.newValue, { persist: false, announce: false });
      }
    };
    const handleSkinChange = (event: Event) => {
      const key = (event as CustomEvent<{ key?: unknown }>).detail?.key;
      if (isNebuSkinKey(key)) applyNebuSkin(key, { persist: false, announce: false });
    };

    window.addEventListener("storage", handleStorage);
    window.addEventListener(NEBU_SKIN_CHANGE_EVENT, handleSkinChange);
    return () => {
      skinAttributeObserver.disconnect();
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener(NEBU_SKIN_CHANGE_EVENT, handleSkinChange);
    };
  }, []);

  useEffect(() => {
    if (!personalisedName) return;
    const scope = document.querySelector(COPY_SCOPE_SELECTOR);
    if (!scope) return;
    return activatePersonalisedCopy(scope, personalisedName);
  }, [pathname, personalisedName]);

  return null;
}
