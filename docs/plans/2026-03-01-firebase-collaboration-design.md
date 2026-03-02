# Real-time Collaborative Receipt Splitting — Design

## Context

Shplit is a single-page client-side receipt splitting app. State lives in React Context + localStorage. There's no way to share a receipt with others. This design adds real-time collaboration via Firebase Firestore so multiple people can view and edit the same receipt simultaneously.

## Requirements

1. Scan a receipt → get a unique shareable URL (`/receipt/{id}`)
2. Anyone with the URL can edit (add people, assign items, change tax/tip)
3. Edits must not overwrite each other — transactions are atomic
4. Zero friction — no sign-up, no auth, no display name prompts

## Architecture: Single Firestore Document

Each receipt is one Firestore document at `receipts/{id}`. This keeps the data model flat and simple. A receipt's full state (10-30 items, 2-8 people, tax/tip config) is well under Firestore's 1MB document limit.

Real-time sync via `onSnapshot`. Mutations via `runTransaction` or `updateDoc` with field-level merges.

## Routing

| Route | Purpose |
|-------|---------|
| `/` | Landing page with scan UI. After OCR, creates Firestore doc, redirects to `/receipt/{id}` |
| `/receipt/[id]` | Collaborative receipt page. Real-time synced via Firestore |
| `/api/ocr` | Server-side OCR endpoint (unchanged) |

## Firestore Data Model

Collection: `receipts`

```typescript
// receipts/{id}
{
  restaurantName: string | null,
  items: ReceiptItem[],       // { id, name, quantity, priceCents, assignedTo[] }
  people: Person[],           // { id, name, color }
  taxTip: TaxTip,             // { taxCents, taxIsPercent, taxPercent, tipCents, tipIsPercent, tipPercent }
  imageDataUrl: string | null,
  ocrText: string | null,
  createdAt: Timestamp,
}
```

### Security Rules

Open read/write for all documents in `receipts`. No auth required.

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /receipts/{receiptId} {
      allow read, write: if true;
    }
  }
}
```

## Conflict Resolution

| Operation | Strategy |
|-----------|----------|
| Update tax/tip | `updateDoc` with `{ taxTip: newValue }` — field-level merge, doesn't touch items/people |
| Toggle assignment | `runTransaction` — read items, toggle assignedTo on target item, write back |
| Add/delete person | `runTransaction` — read people + items, mutate, write back (delete also cleans assignedTo) |
| Add/update/delete item | `runTransaction` — read items, mutate target, write back |
| Move item | `runTransaction` — read items, swap positions, write back |

Transactions retry automatically on contention (up to 5 times by default).

## State Management

Replace `useReducer` + localStorage with a Firestore-backed hook:

- **`useFirestoreReceipt(receiptId: string)`** — subscribes to `onSnapshot`, returns `{ state, loading, error, ...mutations }`
- Each mutation function writes to Firestore directly (transaction or updateDoc)
- No local reducer — Firestore is the single source of truth
- `onSnapshot` fires on every remote change, re-rendering the UI

The `ReceiptContext` wrapper remains but delegates to the Firestore hook on `/receipt/[id]` pages.

## Flow

1. User visits `/`, scans receipt via camera/file upload
2. OCR processes image → parser extracts items + restaurant name
3. App creates Firestore document: `addDoc(collection(db, "receipts"), { items, restaurantName, ... })`
4. App redirects to `/receipt/{newDocId}`
5. `/receipt/[id]` subscribes via `onSnapshot`, renders receipt
6. User shares URL → others open it → same real-time state
7. All edits go through Firestore — no local state divergence

## Firebase Setup

Client SDK (`firebase` npm package) initialized from environment variables:

```
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...
```

New file: `src/lib/firebase.ts` — initializes Firebase app + Firestore instance.

## What Changes

- New: `firebase` npm dependency
- New: `src/lib/firebase.ts` (Firebase init)
- New: `src/hooks/useFirestoreReceipt.ts` (Firestore-backed state hook)
- New: `src/app/receipt/[id]/page.tsx` (collaborative receipt page)
- Modified: `src/app/page.tsx` (scan → create doc → redirect)
- Modified: `src/context/ReceiptContext.tsx` (delegate to Firestore hook)
- Removed: localStorage persistence logic

## What Stays the Same

- All types/interfaces (ReceiptItem, Person, TaxTip, PersonBreakdown)
- Parser, calculator, format libraries
- All UI components (ScanSection, PeopleSection, ItemsSection, etc.)
- OCR API route
- Visual design / styling
- Test suite (parser + calculator tests)
