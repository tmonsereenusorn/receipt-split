# Firebase Collaboration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace localStorage state with Firestore-backed real-time collaboration so multiple users can edit the same receipt via a shared URL.

**Architecture:** Single Firestore document per receipt at `receipts/{id}`. Real-time sync via `onSnapshot`. Mutations via `runTransaction` for atomicity. Landing page (`/`) scans receipt and redirects to `/receipt/[id]`. No auth required.

**Tech Stack:** Firebase JS SDK (firestore), Next.js 16 App Router, React 19

---

### Task 1: Install Firebase and create init module

**Files:**
- Modify: `package.json`
- Create: `src/lib/firebase.ts`

**Step 1: Install firebase**

Run: `npm install firebase`

**Step 2: Create Firebase init module**

Create `src/lib/firebase.ts`:

```typescript
import { initializeApp, getApps } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
export const db = getFirestore(app);
```

**Step 3: Add env placeholder**

Add to `.env.local` (below existing GOOGLE_CLOUD_VISION_API_KEY):

```
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
```

**Step 4: Commit**

```bash
git add package.json package-lock.json src/lib/firebase.ts .env.local
git commit -m "feat: add Firebase SDK and Firestore init module"
```

---

### Task 2: Create Firestore receipt service

**Files:**
- Modify: `src/types/index.ts`
- Create: `src/lib/firestore.ts`

This module encapsulates all Firestore read/write operations. Every mutation uses `runTransaction` to ensure atomicity.

**Step 1: Add Firestore-specific types**

Add to `src/types/index.ts` — a `ReceiptDoc` interface (the Firestore document shape) and export the `initialTaxTip` constant from types so both the context and firestore module can reference it:

```typescript
export const initialTaxTip: TaxTip = {
  taxCents: 0,
  taxIsPercent: false,
  taxPercent: 0,
  tipCents: 0,
  tipIsPercent: true,
  tipPercent: 20,
};

export interface ReceiptDoc {
  restaurantName: string | null;
  items: ReceiptItem[];
  people: Person[];
  taxTip: TaxTip;
  imageDataUrl: string | null;
  ocrText: string | null;
  createdAt: number; // Date.now() timestamp
}
```

Also remove `initialTaxTip` from `src/context/ReceiptContext.tsx` (it now lives in types). Update the import in `ReceiptContext.tsx` to use `initialTaxTip` from `@/types`.

**Step 2: Create firestore service**

Create `src/lib/firestore.ts`:

```typescript
import {
  doc,
  getDoc,
  addDoc,
  collection,
  runTransaction,
  onSnapshot,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "./firebase";
import {
  ReceiptDoc,
  ReceiptItem,
  Person,
  TaxTip,
  initialTaxTip,
} from "@/types";

const COLLECTION = "receipts";

function receiptRef(id: string) {
  return doc(db, COLLECTION, id);
}

/** Create a new receipt document. Returns the document ID. */
export async function createReceipt(
  partial: Partial<ReceiptDoc>
): Promise<string> {
  const data: ReceiptDoc = {
    restaurantName: partial.restaurantName ?? null,
    items: partial.items ?? [],
    people: partial.people ?? [],
    taxTip: partial.taxTip ?? initialTaxTip,
    imageDataUrl: partial.imageDataUrl ?? null,
    ocrText: partial.ocrText ?? null,
    createdAt: Date.now(),
  };
  const ref = await addDoc(collection(db, COLLECTION), data);
  return ref.id;
}

/** Check if a receipt exists. */
export async function receiptExists(id: string): Promise<boolean> {
  const snap = await getDoc(receiptRef(id));
  return snap.exists();
}

/** Subscribe to real-time updates. Returns unsubscribe function. */
export function subscribeToReceipt(
  id: string,
  onData: (data: ReceiptDoc) => void,
  onError: (err: Error) => void
): Unsubscribe {
  return onSnapshot(
    receiptRef(id),
    (snap) => {
      if (snap.exists()) {
        onData(snap.data() as ReceiptDoc);
      }
    },
    onError
  );
}

/** Atomic: set items array */
export async function fsSetItems(id: string, items: ReceiptItem[]) {
  await runTransaction(db, async (tx) => {
    const ref = receiptRef(id);
    tx.update(ref, { items });
  });
}

/** Atomic: add item */
export async function fsAddItem(id: string, item: ReceiptItem) {
  await runTransaction(db, async (tx) => {
    const ref = receiptRef(id);
    const snap = await tx.get(ref);
    const data = snap.data() as ReceiptDoc;
    tx.update(ref, { items: [...data.items, item] });
  });
}

/** Atomic: update item fields */
export async function fsUpdateItem(
  id: string,
  itemId: string,
  updates: Partial<Omit<ReceiptItem, "id">>
) {
  await runTransaction(db, async (tx) => {
    const ref = receiptRef(id);
    const snap = await tx.get(ref);
    const data = snap.data() as ReceiptDoc;
    tx.update(ref, {
      items: data.items.map((item) =>
        item.id === itemId ? { ...item, ...updates } : item
      ),
    });
  });
}

/** Atomic: delete item */
export async function fsDeleteItem(id: string, itemId: string) {
  await runTransaction(db, async (tx) => {
    const ref = receiptRef(id);
    const snap = await tx.get(ref);
    const data = snap.data() as ReceiptDoc;
    tx.update(ref, {
      items: data.items.filter((item) => item.id !== itemId),
    });
  });
}

/** Atomic: move item up or down */
export async function fsMoveItem(
  id: string,
  itemId: string,
  direction: "up" | "down"
) {
  await runTransaction(db, async (tx) => {
    const ref = receiptRef(id);
    const snap = await tx.get(ref);
    const data = snap.data() as ReceiptDoc;
    const items = [...data.items];
    const idx = items.findIndex((i) => i.id === itemId);
    if (idx === -1) return;
    const swap = direction === "up" ? idx - 1 : idx + 1;
    if (swap < 0 || swap >= items.length) return;
    [items[idx], items[swap]] = [items[swap], items[idx]];
    tx.update(ref, { items });
  });
}

/** Atomic: add person */
export async function fsAddPerson(id: string, person: Person) {
  await runTransaction(db, async (tx) => {
    const ref = receiptRef(id);
    const snap = await tx.get(ref);
    const data = snap.data() as ReceiptDoc;
    tx.update(ref, { people: [...data.people, person] });
  });
}

/** Atomic: update person name */
export async function fsUpdatePerson(
  id: string,
  personId: string,
  name: string
) {
  await runTransaction(db, async (tx) => {
    const ref = receiptRef(id);
    const snap = await tx.get(ref);
    const data = snap.data() as ReceiptDoc;
    tx.update(ref, {
      people: data.people.map((p) =>
        p.id === personId ? { ...p, name } : p
      ),
    });
  });
}

/** Atomic: delete person and clean up assignments */
export async function fsDeletePerson(id: string, personId: string) {
  await runTransaction(db, async (tx) => {
    const ref = receiptRef(id);
    const snap = await tx.get(ref);
    const data = snap.data() as ReceiptDoc;
    tx.update(ref, {
      people: data.people.filter((p) => p.id !== personId),
      items: data.items.map((item) => ({
        ...item,
        assignedTo: item.assignedTo.filter((pid) => pid !== personId),
      })),
    });
  });
}

/** Atomic: toggle person assignment on an item */
export async function fsToggleAssignment(
  id: string,
  itemId: string,
  personId: string
) {
  await runTransaction(db, async (tx) => {
    const ref = receiptRef(id);
    const snap = await tx.get(ref);
    const data = snap.data() as ReceiptDoc;
    tx.update(ref, {
      items: data.items.map((item) => {
        if (item.id !== itemId) return item;
        const has = item.assignedTo.includes(personId);
        return {
          ...item,
          assignedTo: has
            ? item.assignedTo.filter((pid) => pid !== personId)
            : [...item.assignedTo, personId],
        };
      }),
    });
  });
}

/** Atomic: update tax/tip */
export async function fsSetTaxTip(id: string, taxTip: Partial<TaxTip>) {
  await runTransaction(db, async (tx) => {
    const ref = receiptRef(id);
    const snap = await tx.get(ref);
    const data = snap.data() as ReceiptDoc;
    tx.update(ref, { taxTip: { ...data.taxTip, ...taxTip } });
  });
}

/** Atomic: set restaurant name */
export async function fsSetRestaurantName(
  id: string,
  name: string | null
) {
  await runTransaction(db, async (tx) => {
    const ref = receiptRef(id);
    tx.update(ref, { restaurantName: name });
  });
}

/** Atomic: set image */
export async function fsSetImage(id: string, dataUrl: string) {
  await runTransaction(db, async (tx) => {
    const ref = receiptRef(id);
    tx.update(ref, { imageDataUrl: dataUrl });
  });
}

/** Atomic: set OCR text */
export async function fsSetOcrText(id: string, text: string) {
  await runTransaction(db, async (tx) => {
    const ref = receiptRef(id);
    tx.update(ref, { ocrText: text });
  });
}
```

**Step 3: Commit**

```bash
git add src/types/index.ts src/lib/firestore.ts src/context/ReceiptContext.tsx
git commit -m "feat: add Firestore receipt service with atomic transactions"
```

---

### Task 3: Create useFirestoreReceipt hook

**Files:**
- Create: `src/hooks/useFirestoreReceipt.ts`

This hook subscribes to a Firestore receipt document and returns the same interface shape as the current `useReceipt` hook, so all UI components work unchanged.

**Step 1: Create the hook**

Create `src/hooks/useFirestoreReceipt.ts`:

```typescript
"use client";

import { useState, useEffect, useCallback } from "react";
import {
  ReceiptDoc,
  ReceiptItem,
  Person,
  TaxTip,
  initialTaxTip,
} from "@/types";
import {
  subscribeToReceipt,
  fsSetItems,
  fsAddItem,
  fsUpdateItem,
  fsDeleteItem,
  fsMoveItem,
  fsAddPerson,
  fsUpdatePerson,
  fsDeletePerson,
  fsToggleAssignment,
  fsSetTaxTip,
  fsSetRestaurantName,
  fsSetImage,
  fsSetOcrText,
} from "@/lib/firestore";

const COLORS = [
  "#22d3ee", "#a78bfa", "#fb7185", "#34d399",
  "#fb923c", "#38bdf8", "#e879f9", "#a3e635",
];

export function useFirestoreReceipt(receiptId: string) {
  const [data, setData] = useState<ReceiptDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);

    const unsubscribe = subscribeToReceipt(
      receiptId,
      (doc) => {
        setData(doc);
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [receiptId]);

  const items = data?.items ?? [];
  const people = data?.people ?? [];
  const taxTip = data?.taxTip ?? initialTaxTip;
  const imageDataUrl = data?.imageDataUrl ?? null;
  const ocrText = data?.ocrText ?? null;
  const restaurantName = data?.restaurantName ?? null;

  const setItems = useCallback(
    (newItems: ReceiptItem[]) => { fsSetItems(receiptId, newItems); },
    [receiptId]
  );

  const addItem = useCallback(
    (name: string, quantity: number, priceCents: number) => {
      fsAddItem(receiptId, {
        id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        name,
        quantity,
        priceCents,
        assignedTo: [],
      });
    },
    [receiptId]
  );

  const updateItem = useCallback(
    (id: string, updates: Partial<Omit<ReceiptItem, "id">>) => {
      fsUpdateItem(receiptId, id, updates);
    },
    [receiptId]
  );

  const deleteItem = useCallback(
    (id: string) => { fsDeleteItem(receiptId, id); },
    [receiptId]
  );

  const moveItem = useCallback(
    (id: string, direction: "up" | "down") => {
      fsMoveItem(receiptId, id, direction);
    },
    [receiptId]
  );

  const addPerson = useCallback(
    (name: string) => {
      const color = COLORS[people.length % COLORS.length];
      fsAddPerson(receiptId, {
        id: `person-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        name,
        color,
      });
    },
    [receiptId, people.length]
  );

  const updatePerson = useCallback(
    (id: string, name: string) => { fsUpdatePerson(receiptId, id, name); },
    [receiptId]
  );

  const deletePerson = useCallback(
    (id: string) => { fsDeletePerson(receiptId, id); },
    [receiptId]
  );

  const toggleAssignment = useCallback(
    (itemId: string, personId: string) => {
      fsToggleAssignment(receiptId, itemId, personId);
    },
    [receiptId]
  );

  const setTaxTip = useCallback(
    (updates: Partial<TaxTip>) => { fsSetTaxTip(receiptId, updates); },
    [receiptId]
  );

  const setRestaurantName = useCallback(
    (name: string | null) => { fsSetRestaurantName(receiptId, name); },
    [receiptId]
  );

  const setImage = useCallback(
    (dataUrl: string) => { fsSetImage(receiptId, dataUrl); },
    [receiptId]
  );

  const setOcrText = useCallback(
    (text: string) => { fsSetOcrText(receiptId, text); },
    [receiptId]
  );

  return {
    items,
    people,
    taxTip,
    imageDataUrl,
    ocrText,
    restaurantName,
    loading,
    error,
    setItems,
    addItem,
    updateItem,
    deleteItem,
    moveItem,
    addPerson,
    updatePerson,
    deletePerson,
    toggleAssignment,
    setTaxTip,
    setRestaurantName,
    setImage,
    setOcrText,
  };
}
```

**Step 2: Commit**

```bash
git add src/hooks/useFirestoreReceipt.ts
git commit -m "feat: add useFirestoreReceipt hook with real-time sync"
```

---

### Task 4: Create the collaborative receipt page

**Files:**
- Create: `src/app/receipt/[id]/page.tsx`

This is the shareable URL page. It uses `useFirestoreReceipt` instead of `useReceipt`. The UI rendering is identical to the current `page.tsx` but backed by Firestore.

**Step 1: Create the page**

Create `src/app/receipt/[id]/page.tsx`:

```typescript
"use client";

import { use } from "react";
import { useFirestoreReceipt } from "@/hooks/useFirestoreReceipt";
import { calculateBreakdowns } from "@/lib/calculator";
import { generateShareText, generateCsv } from "@/lib/format";
import { ReceiptTape } from "@/components/receipt/ReceiptTape";
import { ReceiptHeader } from "@/components/receipt/ReceiptHeader";
import { PeopleSection } from "@/components/receipt/PeopleSection";
import { ItemsSection } from "@/components/receipt/ItemsSection";
import { TaxTipSection } from "@/components/receipt/TaxTipSection";
import { TotalsSection } from "@/components/receipt/TotalsSection";
import { SplitSection } from "@/components/receipt/SplitSection";
import { ShareSection } from "@/components/receipt/ShareSection";
import { PrintItemsList } from "@/components/receipt/PrintItemsList";

export default function CollaborativeReceiptPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const receipt = useFirestoreReceipt(id);

  if (receipt.loading) {
    return (
      <ReceiptTape>
        <div className="py-12 text-center font-mono text-sm text-zinc-500">
          loading receipt...
        </div>
      </ReceiptTape>
    );
  }

  if (receipt.error) {
    return (
      <ReceiptTape>
        <div className="py-12 text-center font-mono text-sm text-red-400">
          {receipt.error}
        </div>
      </ReceiptTape>
    );
  }

  const hasItems = receipt.items.length > 0;
  const hasPeople = receipt.people.length > 0;
  const allAssigned =
    hasItems && receipt.items.every((item) => item.assignedTo.length > 0);

  const breakdowns =
    hasItems && hasPeople
      ? calculateBreakdowns(receipt.items, receipt.people, receipt.taxTip)
      : [];

  const shareText =
    breakdowns.length > 0
      ? generateShareText(receipt.items, receipt.taxTip, breakdowns)
      : "";

  const csvText =
    breakdowns.length > 0
      ? generateCsv(receipt.items, receipt.taxTip, breakdowns)
      : "";

  const unassignedCount = receipt.items.filter(
    (item) => item.assignedTo.length === 0
  ).length;

  return (
    <ReceiptTape>
      <ReceiptHeader restaurantName={receipt.restaurantName} />

      <div className="no-print">
        <PeopleSection
          people={receipt.people}
          onAdd={receipt.addPerson}
          onUpdate={receipt.updatePerson}
          onDelete={receipt.deletePerson}
        />
      </div>

      {hasItems && (
        <div className="no-print">
          <ItemsSection
            items={receipt.items}
            people={receipt.people}
            onUpdate={receipt.updateItem}
            onDelete={receipt.deleteItem}
            onToggleAssignment={receipt.toggleAssignment}
            onAddItem={() => receipt.addItem("New Item", 1, 0)}
          />
        </div>
      )}

      {hasItems && hasPeople && !allAssigned && unassignedCount > 0 && (
        <div className="no-print py-2 text-center font-mono text-xs text-amber-500">
          {unassignedCount} item{unassignedCount !== 1 ? "s" : ""} unassigned
        </div>
      )}

      {hasItems && (
        <div className="no-print">
          <TaxTipSection taxTip={receipt.taxTip} onChange={receipt.setTaxTip} />
        </div>
      )}

      {hasItems && (
        <TotalsSection items={receipt.items} taxTip={receipt.taxTip} />
      )}

      {allAssigned && hasPeople && (
        <SplitSection breakdowns={breakdowns} />
      )}

      {allAssigned && hasPeople && (
        <ShareSection shareText={shareText} csvText={csvText} />
      )}

      {hasItems && (
        <PrintItemsList items={receipt.items} />
      )}
    </ReceiptTape>
  );
}
```

Note: No ScanSection on the collaborative page — scanning happens on the landing page. No "start over" button — the receipt is persistent. PeopleSection is always shown (not gated by `hasItems`) so collaborators who open a receipt with items already scanned can immediately add their names.

**Step 2: Commit**

```bash
git add src/app/receipt/\[id\]/page.tsx
git commit -m "feat: add collaborative receipt page at /receipt/[id]"
```

---

### Task 5: Refactor landing page to create Firestore receipts

**Files:**
- Modify: `src/app/page.tsx`
- Modify: `src/components/receipt/ScanSection.tsx`

The landing page now creates a Firestore document after scanning and redirects to `/receipt/{id}`. It also supports "skip scan" which creates an empty receipt.

**Step 1: Update ScanSection to return parsed data instead of dispatching**

Change `ScanSection` props to pass back the OCR results instead of writing to context. Add an `onScanResult` callback:

Modify `src/components/receipt/ScanSection.tsx` — change the props interface and `handleCapture`:

```typescript
"use client";

import { useState } from "react";
import { useOcr } from "@/hooks/useOcr";
import { parseReceiptText, parseRestaurantName } from "@/lib/parser";
import { ImageCapture } from "@/components/scan/ImageCapture";
import { ImagePreview } from "@/components/scan/ImagePreview";
import { OcrProgressDisplay } from "@/components/scan/OcrProgress";
import { Section } from "./Section";
import { formatCents } from "@/lib/format";
import { ReceiptItem } from "@/types";

interface ScanResult {
  items: ReceiptItem[];
  restaurantName: string | null;
  ocrText: string;
  imageDataUrl: string;
}

interface ScanSectionProps {
  onScanResult: (result: ScanResult) => void;
  onSkip: () => void;
}

export function ScanSection({ onScanResult, onSkip }: ScanSectionProps) {
  const ocr = useOcr();
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [parsedItems, setParsedItems] = useState<ReceiptItem[]>([]);

  async function handleCapture(file: File, dataUrl: string) {
    setImageDataUrl(dataUrl);

    const text = await ocr.recognize(file);
    if (text) {
      const items = parseReceiptText(text);
      const restaurantName = parseRestaurantName(text);
      setParsedItems(items);
      onScanResult({ items, restaurantName, ocrText: text, imageDataUrl: dataUrl });
    }
  }

  function handleRetake() {
    setImageDataUrl(null);
    setParsedItems([]);
  }

  return (
    <Section>
      {!imageDataUrl && !ocr.isProcessing && (
        <ImageCapture onCapture={handleCapture} />
      )}

      {imageDataUrl && !ocr.isProcessing && !ocr.result && (
        <ImagePreview dataUrl={imageDataUrl} onRetake={handleRetake} />
      )}

      {ocr.isProcessing && (
        <OcrProgressDisplay isProcessing={ocr.isProcessing} />
      )}

      {ocr.error && (
        <p className="py-2 text-center font-mono text-xs text-red-400">{ocr.error}</p>
      )}

      {ocr.result && !ocr.isProcessing && (
        <div className="space-y-2 py-2">
          <div className="font-mono text-xs text-green-500">
            ✓ {parsedItems.length} item{parsedItems.length !== 1 ? "s" : ""} detected
          </div>
          {parsedItems.map((item) => (
            <div
              key={item.id}
              className="flex justify-between font-mono text-xs text-zinc-400"
            >
              <span className="truncate">{item.name}</span>
              <span className="ml-2 text-zinc-300">{formatCents(item.priceCents)}</span>
            </div>
          ))}
        </div>
      )}

      {!ocr.isProcessing && !ocr.result && (
        <button
          type="button"
          onClick={onSkip}
          className="block w-full py-1 text-center text-xs text-zinc-600 hover:text-zinc-400"
        >
          skip scan, enter items manually →
        </button>
      )}
    </Section>
  );
}
```

**Step 2: Rewrite landing page**

Replace `src/app/page.tsx` entirely. It no longer uses `useReceipt`. After scan or skip, it creates a Firestore doc and redirects:

```typescript
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createReceipt } from "@/lib/firestore";
import { ReceiptTape } from "@/components/receipt/ReceiptTape";
import { ReceiptHeader } from "@/components/receipt/ReceiptHeader";
import { ScanSection } from "@/components/receipt/ScanSection";
import { ReceiptItem } from "@/types";

interface ScanResult {
  items: ReceiptItem[];
  restaurantName: string | null;
  ocrText: string;
  imageDataUrl: string;
}

export default function LandingPage() {
  const router = useRouter();
  const [isCreating, setIsCreating] = useState(false);

  async function handleScanResult(result: ScanResult) {
    setIsCreating(true);
    const id = await createReceipt({
      items: result.items,
      restaurantName: result.restaurantName,
      ocrText: result.ocrText,
      imageDataUrl: result.imageDataUrl,
    });
    router.push(`/receipt/${id}`);
  }

  async function handleSkip() {
    setIsCreating(true);
    const id = await createReceipt({
      items: [
        {
          id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          name: "New Item",
          quantity: 1,
          priceCents: 0,
          assignedTo: [],
        },
      ],
    });
    router.push(`/receipt/${id}`);
  }

  return (
    <ReceiptTape>
      <ReceiptHeader />
      {isCreating ? (
        <div className="py-8 text-center font-mono text-sm text-zinc-500">
          creating receipt...
        </div>
      ) : (
        <div className="no-print">
          <ScanSection onScanResult={handleScanResult} onSkip={handleSkip} />
        </div>
      )}
    </ReceiptTape>
  );
}
```

**Step 3: Commit**

```bash
git add src/app/page.tsx src/components/receipt/ScanSection.tsx
git commit -m "feat: landing page creates Firestore receipt and redirects"
```

---

### Task 6: Remove localStorage persistence from ReceiptContext

**Files:**
- Modify: `src/context/ReceiptContext.tsx`
- Modify: `src/app/layout.tsx`

The ReceiptContext is no longer needed for the collaborative page (which uses `useFirestoreReceipt` directly). Simplify it — remove localStorage persistence entirely. The context still exists for potential local-only use but is no longer the primary state store.

**Step 1: Simplify ReceiptContext**

Remove `loadState`, the localStorage effect, and the `isInitialized` ref. The context keeps its reducer for any components that still reference it during the landing flow, but state is ephemeral:

```typescript
"use client";

import {
  createContext,
  useReducer,
  type ReactNode,
} from "react";
import { ReceiptState, ReceiptAction, initialTaxTip } from "@/types";

const initialState: ReceiptState = {
  items: [],
  people: [],
  taxTip: initialTaxTip,
  imageDataUrl: null,
  ocrText: null,
  restaurantName: null,
};

function receiptReducer(
  state: ReceiptState,
  action: ReceiptAction
): ReceiptState {
  switch (action.type) {
    case "SET_ITEMS":
      return { ...state, items: action.items };
    case "ADD_ITEM":
      return { ...state, items: [...state.items, action.item] };
    case "UPDATE_ITEM":
      return {
        ...state,
        items: state.items.map((item) =>
          item.id === action.id ? { ...item, ...action.updates } : item
        ),
      };
    case "DELETE_ITEM":
      return {
        ...state,
        items: state.items.filter((item) => item.id !== action.id),
      };
    case "ADD_PERSON":
      return { ...state, people: [...state.people, action.person] };
    case "UPDATE_PERSON":
      return {
        ...state,
        people: state.people.map((p) =>
          p.id === action.id ? { ...p, name: action.name } : p
        ),
      };
    case "DELETE_PERSON": {
      return {
        ...state,
        people: state.people.filter((p) => p.id !== action.id),
        items: state.items.map((item) => ({
          ...item,
          assignedTo: item.assignedTo.filter((id) => id !== action.id),
        })),
      };
    }
    case "TOGGLE_ASSIGNMENT": {
      return {
        ...state,
        items: state.items.map((item) => {
          if (item.id !== action.itemId) return item;
          const has = item.assignedTo.includes(action.personId);
          return {
            ...item,
            assignedTo: has
              ? item.assignedTo.filter((id) => id !== action.personId)
              : [...item.assignedTo, action.personId],
          };
        }),
      };
    }
    case "MOVE_ITEM": {
      const items = [...state.items];
      const idx = items.findIndex((i) => i.id === action.id);
      if (idx === -1) return state;
      const swap = action.direction === "up" ? idx - 1 : idx + 1;
      if (swap < 0 || swap >= items.length) return state;
      [items[idx], items[swap]] = [items[swap], items[idx]];
      return { ...state, items };
    }
    case "SET_TAX_TIP":
      return {
        ...state,
        taxTip: { ...state.taxTip, ...action.taxTip },
      };
    case "SET_IMAGE":
      return { ...state, imageDataUrl: action.dataUrl };
    case "SET_OCR_TEXT":
      return { ...state, ocrText: action.text };
    case "SET_RESTAURANT_NAME":
      return { ...state, restaurantName: action.name };
    case "RESET":
      return initialState;
    default:
      return state;
  }
}

export const ReceiptContext = createContext<{
  state: ReceiptState;
  dispatch: React.Dispatch<ReceiptAction>;
}>({
  state: initialState,
  dispatch: () => undefined,
});

export function ReceiptProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(receiptReducer, initialState);

  return (
    <ReceiptContext.Provider value={{ state, dispatch }}>
      {children}
    </ReceiptContext.Provider>
  );
}
```

**Step 2: Commit**

```bash
git add src/context/ReceiptContext.tsx
git commit -m "refactor: remove localStorage persistence from ReceiptContext"
```

---

### Task 7: Verify build and existing tests pass

**Step 1: Run tests**

Run: `npm test`
Expected: All 39 tests pass (parser + calculator tests are unchanged)

**Step 2: Run build**

Run: `npm run build`
Expected: Clean build with no TypeScript errors. New route `/receipt/[id]` appears in output.

**Step 3: Fix any issues**

Address any TypeScript errors or build issues that arise from the refactoring.

**Step 4: Commit any fixes**

```bash
git add -A
git commit -m "fix: resolve build issues from Firebase refactoring"
```

(Only if fixes were needed.)

---

### Task 8: Final verification and push

**Step 1: Run full check**

```bash
npm test && npm run build
```

Both must pass cleanly.

**Step 2: Push**

```bash
git push
```

---

## Post-Implementation: Firebase Project Setup

After code is deployed, the user needs to:

1. Create a Firebase project at https://console.firebase.google.com
2. Enable Firestore in the project
3. Set open security rules for `receipts` collection
4. Copy the Firebase config values into `.env.local`
5. Deploy (or run locally with `npm run dev`)

Detailed steps will be provided after implementation.
