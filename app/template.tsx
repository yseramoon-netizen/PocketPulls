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

const PAGE_TITLES: ReadonlyArray<readonly [string, string]> = [
  ["/wishes/preview", "Wish Ceremony Preview"],
  ["/wishes/shop", "Wish Shop"],
  ["/wishes", "Wishes"],
  ["/collection", "Collection"],
  ["/catalogue", "Card Catalogue"],
  ["/constellation", "Constellation"],
  ["/achievements", "Achievements"],
  ["/leaderboard", "Leaderboard"],
  ["/friends", "Friends"],
  ["/trade", "Trade"],
  ["/shipping", "Shipping"],
  ["/history", "Wish History"],
  ["/profile", "Profile"],
  ["/create-account", "Create Account"],
  ["/check-email", "Check Your Email"],
  ["/auth/callback", "Confirming Email"],
  ["/forgot-password", "Reset Password"],
  ["/update-password", "Choose New Password"],
  ["/sign-in", "Sign In"],
  ["/sign-up", "Create Account"],
  ["/login", "Sign In"],
  ["/welcome", "Welcome"],
  ["/faq", "FAQ"],
  ["/help", "Help"],
  ["/terms", "Terms"],
  ["/rules", "Rules"],
  ["/odds", "Wish Odds"],
  ["/player-protection", "Player Protection"],
  ["/how-wishes-work", "How Wishes Work"],
  ["/hq", "Trainer HQ"],
] as const;

function getPageTitle(pathname: string): string {
  const title = PAGE_TITLES.find(
    ([path]) => pathname === path || pathname.startsWith(`${path}/`),
  )?.[1];

  return title ? `${title} · ancientpulls` : "ancientpulls";
}

export default function RootTemplate({
  children,
}: RootTemplateProps) {
  const pathname = usePathname();

  useEffect(() => {
    const pageTitle = getPageTitle(pathname);

    const applyTitle = () => {
      if (
        document.title !==
        pageTitle
      ) {
        document.title =
          pageTitle;
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
