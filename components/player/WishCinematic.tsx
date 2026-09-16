"use client";
import { getWishRevealConfig, type WishRevealConfig } from "@/lib/player/wish-reveal";
import FlightCeremony from "./astral/FlightCeremony";
export type WishRevealCard = {
    id?: string | number;
    name: string;
    rarity?: string | null;
    imageUrl?: string | null;
    setName?: string | null;
    cardNumber?: string | null;
    marketValue?: number | null;
};
export type WishCinematicProps = {
    open: boolean;
    card: WishRevealCard | null;
    onClose: () => void;
    cards?: readonly WishRevealCard[];
    onPlace?: (cards: readonly WishRevealCard[]) => void;
    onFinished?: () => void;
    onWishAgain?: () => void;
    canWishAgain?: boolean;
    busy?: boolean;
    actionError?: string | null;
    allowSkip?: boolean;
    forceFullSequence?: boolean;
    respectPreferences?: boolean;
    cosmicIssueNumber?: number | null;
    cosmicBinderIssueNumber?: number | null;
    /** Accepted for older callers; character skins no longer control this animation. */
    cosmicSourceSkin?: string | null;
};
export function getWishRarityTheme(rarity: string | null | undefined): WishRevealConfig {
    return getWishRevealConfig(rarity);
}
export default FlightCeremony;
