# Recently Viewed Receipts — Design

## Problem
Users have no way to return to previously viewed receipts. Once they navigate away from a receipt URL, it's lost unless they bookmarked it.

## Solution
Store recently viewed receipts in localStorage and display them on the landing page.

## Data Model

```ts
interface RecentReceipt {
  id: string;        // Firestore doc ID
  name: string;      // restaurant name at time of last visit
  viewedAt: number;  // Date.now() timestamp
}
```

- localStorage key: `shplit:recent`
- JSON array, sorted by `viewedAt` descending
- Max 10 entries; oldest evicted on overflow

## Hook: `useRecentReceipts`

Location: `src/hooks/useRecentReceipts.ts`

Exports:
- `recents: RecentReceipt[]` — current list, reactive via `useState`
- `upsert(id: string, name: string)` — add or update entry, bump `viewedAt`, evict if >10
- `remove(id: string)` — delete a single entry

## Recording Visits

In `/receipt/[id]/page.tsx`, after receipt data loads (not loading, no error), call `upsert(id, restaurantName)`. This captures both self-created and shared receipts and keeps names current.

## Landing Page UI

Below the scan section, render a "Recent" section (hidden when empty). Each row:
- Link to `/receipt/[id]`
- Restaurant name on the left (or "Untitled" if null)
- Relative time on the right ("just now", "5m ago", "2h ago", "3d ago")
- X button to dismiss individual entries

Styled to match receipt-tape aesthetic: monospace, zinc tones.

## `timeAgo` Helper

Location: `src/lib/format.ts`

No external library. Returns: "just now", "Xm ago", "Xh ago", "Xd ago".
