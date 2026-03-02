"use client";

import { useState, useCallback } from "react";

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
    return raw ? JSON.parse(raw) : [];
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
  const [recents, setRecents] = useState<RecentReceipt[]>(readRecents);

  const upsert = useCallback((id: string, name: string | null) => {
    setRecents((prev) => {
      const filtered = prev.filter((r) => r.id !== id);
      const updated = [
        { id, name: name || "Untitled", viewedAt: Date.now() },
        ...filtered,
      ].slice(0, MAX_ENTRIES);
      writeRecents(updated);
      return updated;
    });
  }, []);

  const remove = useCallback((id: string) => {
    setRecents((prev) => {
      const updated = prev.filter((r) => r.id !== id);
      writeRecents(updated);
      return updated;
    });
  }, []);

  return { recents, upsert, remove };
}
