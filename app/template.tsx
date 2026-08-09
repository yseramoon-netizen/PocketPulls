"use client";

import type {
  ReactNode,
} from "react";
import {
  useEffect,
} from "react";
import {
  usePathname,
} from "next/navigation";

type RootTemplateProps = {
  children: ReactNode;
};

export default function RootTemplate({
  children,
}: RootTemplateProps) {
  const pathname = usePathname();

  useEffect(() => {
    const applyTitle = () => {
      if (
        document.title !==
        "Ancient Pulls"
      ) {
        document.title =
          "Ancient Pulls";
      }
    };

    applyTitle();

    const observer =
      new MutationObserver(
        applyTitle,
      );

    observer.observe(
      document.head,
      {
        childList: true,
        subtree: true,
        characterData: true,
      },
    );

    return () => {
      observer.disconnect();
    };
  }, [pathname]);

  return children;
}
