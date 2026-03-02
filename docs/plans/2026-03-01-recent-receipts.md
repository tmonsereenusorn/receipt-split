# Recently Viewed Receipts Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Store recently viewed receipts in localStorage and display them on the landing page so users can quickly return to previous receipts.

**Architecture:** A `timeAgo` helper in `format.ts` for relative timestamps. A `useRecentReceipts` hook wraps localStorage read/write with React state. The receipt page calls `upsert` on load. The landing page renders the list.

**Tech Stack:** React hooks, localStorage, Vitest for unit tests.

---

### Task 1: Add `timeAgo` helper

**Files:**
- Modify: `src/lib/format.ts` (append to end)
- Test: `src/lib/__tests__/format.test.ts` (create)

**Step 1: Write the test**

Create `src/lib/__tests__/format.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { timeAgo } from "../format";

describe("timeAgo", () => {
  it("returns 'just now' for timestamps less than 60s ago", () => {
    expect(timeAgo(Date.now() - 30_000)).toBe("just now");
  });

  it("returns minutes ago", () => {
    expect(timeAgo(Date.now() - 5 * 60_000)).toBe("5m ago");
  });

  it("returns hours ago", () => {
    expect(timeAgo(Date.now() - 3 * 3_600_000)).toBe("3h ago");
  });

  it("returns days ago", () => {
    expect(timeAgo(Date.now() - 2 * 86_400_000)).toBe("2d ago");
  });

  it("returns '1m ago' at exactly 60 seconds", () => {
    expect(timeAgo(Date.now() - 60_000)).toBe("1m ago");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/__tests__/format.test.ts`
Expected: FAIL — `timeAgo` is not exported.

**Step 3: Write implementation**

Append to `src/lib/format.ts`:

```ts
export function timeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/__tests__/format.test.ts`
Expected: 5 tests PASS.

**Step 5: Commit**

```bash
git add src/lib/format.ts src/lib/__tests__/format.test.ts
git commit -m "feat: add timeAgo helper for relative timestamps"
```

---

### Task 2: Create `useRecentReceipts` hook

**Files:**
- Create: `src/hooks/useRecentReceipts.ts`

**Step 1: Create the hook**

Create `src/hooks/useRecentReceipts.ts`:

```ts
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
  localStorage.setItem(STORAGE_KEY, JSON.stringify(recents));
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
```

**Step 2: Run build to verify no type errors**

Run: `npm run build`
Expected: Compiled successfully.

**Step 3: Commit**

```bash
git add src/hooks/useRecentReceipts.ts
git commit -m "feat: add useRecentReceipts hook with localStorage persistence"
```

---

### Task 3: Record visits from the receipt page

**Files:**
- Modify: `src/app/receipt/[id]/page.tsx`

**Step 1: Add the upsert call**

Import the hook and call `upsert` when data loads. Add these changes to `src/app/receipt/[id]/page.tsx`:

1. Add import:
```ts
import { useRecentReceipts } from "@/hooks/useRecentReceipts";
```

2. Inside the component, after `const receipt = useFirestoreReceipt(id);`, add:
```ts
const { upsert: upsertRecent } = useRecentReceipts();
```

3. Add a `useEffect` (import `useEffect` from react) after the hook calls to record the visit when data loads:
```ts
useEffect(() => {
  if (!receipt.loading && !receipt.error) {
    upsertRecent(id, receipt.restaurantName);
  }
}, [id, receipt.loading, receipt.error, receipt.restaurantName, upsertRecent]);
```

**Step 2: Run build to verify**

Run: `npm run build`
Expected: Compiled successfully.

**Step 3: Commit**

```bash
git add src/app/receipt/\\[id\\]/page.tsx
git commit -m "feat: record receipt visits to recently viewed list"
```

---

### Task 4: Add RecentSection component and wire into landing page

**Files:**
- Create: `src/components/receipt/RecentSection.tsx`
- Modify: `src/app/page.tsx`

**Step 1: Create the component**

Create `src/components/receipt/RecentSection.tsx`:

```tsx
"use client";

import Link from "next/link";
import { RecentReceipt } from "@/hooks/useRecentReceipts";
import { timeAgo } from "@/lib/format";
import { Section } from "./Section";

interface RecentSectionProps {
  recents: RecentReceipt[];
  onRemove: (id: string) => void;
}

export function RecentSection({ recents, onRemove }: RecentSectionProps) {
  if (recents.length === 0) return null;

  return (
    <Section>
      <h3 className="mb-3 text-xs font-medium uppercase tracking-wider text-zinc-500">
        Recent
      </h3>
      <div className="space-y-1">
        {recents.map((r) => (
          <div key={r.id} className="group flex items-center">
            <Link
              href={`/receipt/${r.id}`}
              className="flex min-w-0 flex-1 items-center justify-between py-1.5 font-mono text-sm transition-colors hover:text-amber-500"
            >
              <span className="truncate text-zinc-200 group-hover:text-amber-500">
                {r.name}
              </span>
              <span className="ml-3 shrink-0 text-xs text-zinc-600">
                {timeAgo(r.viewedAt)}
              </span>
            </Link>
            <button
              type="button"
              onClick={() => onRemove(r.id)}
              className="ml-2 shrink-0 px-1 text-xs text-zinc-600 opacity-0 transition-opacity hover:text-zinc-400 group-hover:opacity-100"
              aria-label={`Remove ${r.name} from recent`}
            >
              &times;
            </button>
          </div>
        ))}
      </div>
    </Section>
  );
}
```

**Step 2: Wire into landing page**

Modify `src/app/page.tsx`:

1. Add imports:
```ts
import { useRecentReceipts } from "@/hooks/useRecentReceipts";
import { RecentSection } from "@/components/receipt/RecentSection";
```

2. Inside `LandingPage`, add after existing state hooks:
```ts
const { recents, remove: removeRecent } = useRecentReceipts();
```

3. Add the `RecentSection` after the `ScanSection` block (after the closing `)}` of the ternary), before `</ReceiptTape>`:
```tsx
<RecentSection recents={recents} onRemove={removeRecent} />
```

**Step 3: Run build and tests**

Run: `npm run build && npm test`
Expected: Build succeeds. All tests pass (39 existing + 5 new format tests = 44).

**Step 4: Commit**

```bash
git add src/components/receipt/RecentSection.tsx src/app/page.tsx
git commit -m "feat: add recently viewed receipts list to landing page"
```
