"use client";

import { useState, useCallback, useEffect, useRef } from "react";

const STORAGE_KEY = "shplit:recent";
const MAX_ENTRIES = 10;

export interface RecentReceipt {
  id: string;
  name: string;
  viewedAt: number;
}

function readRecents(): RecentReceipt[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeRecents(recents: RecentReceipt[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(recents));
  } catch {
    // Quota exceeded or unavailable — state is still updated in memory
  }
}

export function useRecentReceipts() {
  const [recents, setRecents] = useState<RecentReceipt[]>([]);
  const isInitialized = useRef(false);

  useEffect(() => {
    setRecents(readRecents());
    isInitialized.current = true;
  }, []);

  useEffect(() => {
    if (isInitialized.current) {
      writeRecents(recents);
    }
  }, [recents]);

  const upsert = useCallback((id: string, name: string | null) => {
    setRecents((prev) => {
      const filtered = prev.filter((r) => r.id !== id);
      return [
        { id, name: name || "Untitled", viewedAt: Date.now() },
        ...filtered,
      ].slice(0, MAX_ENTRIES);
    });
  }, []);

  const remove = useCallback((id: string) => {
    setRecents((prev) => {
      return prev.filter((r) => r.id !== id);
    });
  }, []);

  return { recents, upsert, remove };
}
