"use client";

import { useEffect } from "react";

import {
  applyNebuSkin,
  isNebuSkinKey,
  NEBU_SKIN_CHANGE_EVENT,
  NEBU_SKIN_STORAGE_KEY,
  readNebuSkin,
} from "@/lib/player/nebu";

const COPY_SCOPE_SELECTOR = ".unknown-pulls-shell";
const COPY_ATTRIBUTES = ["alt", "aria-label", "title", "placeholder"] as const;

function personaliseNebuName(value: string): string {
  return value
    .replace(/\bNEBU\b/g, "BUBBLES")
    .replace(/\bNebu\b/g, "Bubbles")
    .replace(/\bnebu\b/g, "bubbles");
}

function containsNebu(value: string): boolean {
  return /\bnebu\b/i.test(value);
}

function containsBubbles(value: string): boolean {
  return /\bbubbles\b/i.test(value);
}

function activateBubblesCopy(): () => void {
  const originalText = new Map<Text, string>();
  const originalAttributes = new Map<Element, Map<string, string>>();
  let activeScope: Element | null = null;
  let scopeObserver: MutationObserver | null = null;

  const personaliseText = (node: Text) => {
    const parentTag = node.parentElement?.tagName;

    if (parentTag === "SCRIPT" || parentTag === "STYLE" || parentTag === "NOSCRIPT") {
      return;
    }

    const current = node.data;

    if (containsNebu(current)) {
      originalText.set(node, current);
      node.data = personaliseNebuName(current);
      return;
    }

    if (originalText.has(node) && !containsBubbles(current)) {
      originalText.delete(node);
    }
  };

  const personaliseAttributes = (element: Element) => {
    let originals = originalAttributes.get(element);

    for (const attribute of COPY_ATTRIBUTES) {
      const current = element.getAttribute(attribute);

      if (current && containsNebu(current)) {
        if (!originals) {
          originals = new Map<string, string>();
          originalAttributes.set(element, originals);
        }

        originals.set(attribute, current);
        element.setAttribute(attribute, personaliseNebuName(current));
      } else if (
        originals?.has(attribute) &&
        (!current || !containsBubbles(current))
      ) {
        originals.delete(attribute);
      }
    }

    if (originals?.size === 0) {
      originalAttributes.delete(element);
    }
  };

  const personaliseTree = (root: Node) => {
    if (root.nodeType === Node.TEXT_NODE) {
      personaliseText(root as Text);
      return;
    }

    if (root.nodeType !== Node.ELEMENT_NODE) {
      return;
    }

    personaliseAttributes(root as Element);

    const walker = document.createTreeWalker(
      root,
      NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT,
    );

    let node = walker.nextNode();

    while (node) {
      if (node.nodeType === Node.TEXT_NODE) {
        personaliseText(node as Text);
      } else {
        personaliseAttributes(node as Element);
      }

      node = walker.nextNode();
    }
  };

  const bindScope = () => {
    const nextScope = document.querySelector(COPY_SCOPE_SELECTOR);

    if (nextScope === activeScope) {
      return;
    }

    scopeObserver?.disconnect();
    scopeObserver = null;
    activeScope = nextScope;

    if (!activeScope) {
      return;
    }

    personaliseTree(activeScope);
    scopeObserver = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === "characterData") {
          personaliseText(mutation.target as Text);
          continue;
        }

        if (mutation.type === "attributes") {
          personaliseAttributes(mutation.target as Element);
          continue;
        }

        for (const addedNode of mutation.addedNodes) {
          personaliseTree(addedNode);
        }
      }
    });
    scopeObserver.observe(activeScope, {
      attributes: true,
      attributeFilter: [...COPY_ATTRIBUTES],
      characterData: true,
      childList: true,
      subtree: true,
    });
  };

  const shellObserver = new MutationObserver(bindScope);
  shellObserver.observe(document.body, { childList: true, subtree: true });
  bindScope();

  return () => {
    scopeObserver?.disconnect();
    shellObserver.disconnect();

    for (const [node, value] of originalText) {
      if (node.isConnected) {
        node.data = value;
      }
    }

    for (const [element, attributes] of originalAttributes) {
      if (!element.isConnected) {
        continue;
      }

      for (const [attribute, value] of attributes) {
        element.setAttribute(attribute, value);
      }
    }
  };
}

export default function NebuSkinController() {
  useEffect(() => {
    let stopBubblesCopy: (() => void) | null = null;

    const syncMascotName = () => {
      const bubblesIsEquipped =
        document.documentElement.dataset.nebuSkin === "bubbles";

      if (bubblesIsEquipped && !stopBubblesCopy) {
        stopBubblesCopy = activateBubblesCopy();
      } else if (!bubblesIsEquipped && stopBubblesCopy) {
        stopBubblesCopy();
        stopBubblesCopy = null;
      }
    };

    const skinAttributeObserver = new MutationObserver(syncMascotName);
    skinAttributeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-nebu-skin"],
    });

    applyNebuSkin(readNebuSkin(), { persist: false, announce: false });
    syncMascotName();

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
        applyNebuSkin(key, { persist: false, announce: false });
      }
    };

    window.addEventListener("storage", handleStorage);
    window.addEventListener(NEBU_SKIN_CHANGE_EVENT, handleSkinChange);

    return () => {
      skinAttributeObserver.disconnect();
      stopBubblesCopy?.();
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener(NEBU_SKIN_CHANGE_EVENT, handleSkinChange);
    };
  }, []);

  return null;
}
