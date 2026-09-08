"use client";
import { useCallback, useEffect, useState, type SetStateAction } from "react";
import { DEFAULT_BROWSE_FILTERS, parseBrowseFilters, writeBrowseFilters, type BrowseFilters } from "./browseFilters";

/** URL-backed filters preserve the current page through details, shipping and Back. */
export default function useBrowseFilters() {
  const [filters, setFilters] = useState(DEFAULT_BROWSE_FILTERS);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const restore = () => {
      setFilters(parseBrowseFilters(window.location.search));
      setReady(true);
    };
    restore();
    window.addEventListener("popstate", restore);
    return () => window.removeEventListener("popstate", restore);
  }, []);
  useEffect(() => {
    if (!ready) return;
    const query = writeBrowseFilters(window.location.search, filters);
    const url = window.location.pathname + (query ? `?${query}` : "") + window.location.hash;
    window.history.replaceState(window.history.state, "", url);
  }, [filters, ready]);
  const setField = useCallback(<K extends keyof BrowseFilters>(key: K, value: SetStateAction<BrowseFilters[K]>) => {
    setFilters((current) => {
      const next = typeof value === "function" ? (value as (v: BrowseFilters[K]) => BrowseFilters[K])(current[key]) : value;
      return current[key] === next ? current : { ...current, [key]: next };
    });
  }, []);
  const setSearch = useCallback((value: SetStateAction<string>) => setField("search", value), [setField]);
  const setSetName = useCallback((value: SetStateAction<string>) => setField("setName", value), [setField]);
  const setRarity = useCallback((value: SetStateAction<string>) => setField("rarity", value), [setField]);
  const setAvailability = useCallback((value: SetStateAction<BrowseFilters["availability"]>) => setField("availability", value), [setField]);
  const setPage = useCallback((value: SetStateAction<number>) => setField("page", value), [setField]);
  const setFavouritesOnly = useCallback((value: SetStateAction<boolean>) => setField("favouritesOnly", value), [setField]);
  return { ...filters, setFavouritesOnly, ready, setSearch, setSetName, setRarity, setAvailability, setPage };
}
