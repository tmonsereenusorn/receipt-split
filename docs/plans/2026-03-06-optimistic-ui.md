# Optimistic UI Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make all Firestore mutations feel instant by applying state changes locally before the network round-trip.

**Architecture:** Each mutation callback in `useFirestoreReceipt` gets a `setData(prev => ...)` call before the existing Firestore call. `onSnapshot` continues to overwrite local state with server truth. No changes to components or `firestore.ts`.

**Tech Stack:** React (useState/useCallback), Firebase Firestore (existing)

---

### Task 1: Add optimistic updates to item mutations

**Files:**
- Modify: `src/hooks/useFirestoreReceipt.ts:60-101`

**Step 1: Update `setItems`**

Replace lines 60-63:

```ts
const setItems = useCallback(
  (newItems: ReceiptItem[]) => {
    setData(prev => prev ? { ...prev, items: newItems } : prev);
    fsSetItems(receiptId, newItems);
  },
  [receiptId]
);
```

**Step 2: Update `addItem`**

Replace lines 65-76:

```ts
const addItem = useCallback(
  (name: string, quantity: number, priceCents: number) => {
    const item: ReceiptItem = {
      id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name,
      quantity,
      priceCents,
      assignedTo: [],
    };
    setData(prev => prev ? { ...prev, items: [item, ...prev.items] } : prev);
    fsAddItem(receiptId, item);
  },
  [receiptId]
);
```

**Step 3: Update `updateItem`**

Replace lines 78-83:

```ts
const updateItem = useCallback(
  (id: string, updates: Partial<Omit<ReceiptItem, "id">>) => {
    setData(prev => prev ? {
      ...prev,
      items: prev.items.map(item =>
        item.id === id ? { ...item, ...updates } : item
      ),
    } : prev);
    fsUpdateItem(receiptId, id, updates);
  },
  [receiptId]
);
```

**Step 4: Update `deleteItem`**

Replace lines 85-88:

```ts
const deleteItem = useCallback(
  (id: string) => {
    setData(prev => prev ? {
      ...prev,
      items: prev.items.filter(item => item.id !== id),
    } : prev);
    fsDeleteItem(receiptId, id);
  },
  [receiptId]
);
```

**Step 5: Update `moveItem`**

Replace lines 90-95:

```ts
const moveItem = useCallback(
  (id: string, direction: "up" | "down") => {
    setData(prev => {
      if (!prev) return prev;
      const items = [...prev.items];
      const idx = items.findIndex(i => i.id === id);
      if (idx === -1) return prev;
      const swap = direction === "up" ? idx - 1 : idx + 1;
      if (swap < 0 || swap >= items.length) return prev;
      [items[idx], items[swap]] = [items[swap], items[idx]];
      return { ...prev, items };
    });
    fsMoveItem(receiptId, id, direction);
  },
  [receiptId]
);
```

**Step 6: Update `reorderItem`**

Replace lines 97-102:

```ts
const reorderItem = useCallback(
  (itemId: string, newIndex: number) => {
    setData(prev => {
      if (!prev) return prev;
      const items = [...prev.items];
      const oldIndex = items.findIndex(i => i.id === itemId);
      if (oldIndex === -1) return prev;
      const [item] = items.splice(oldIndex, 1);
      items.splice(newIndex, 0, item);
      return { ...prev, items };
    });
    fsReorderItem(receiptId, itemId, newIndex);
  },
  [receiptId]
);
```

**Step 7: Build and verify**

Run: `npm run build`
Expected: Compiles successfully

**Step 8: Commit**

```bash
git add src/hooks/useFirestoreReceipt.ts
git commit -m "feat: optimistic local updates for item mutations"
```

---

### Task 2: Add optimistic updates to people mutations

**Files:**
- Modify: `src/hooks/useFirestoreReceipt.ts:104-131`

**Step 1: Update `addPerson`**

Replace lines 104-114:

```ts
const addPerson = useCallback(
  (name: string) => {
    const color = PERSON_COLORS[people.length % PERSON_COLORS.length];
    const person = {
      id: `person-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name,
      color,
    };
    setData(prev => prev ? { ...prev, people: [...prev.people, person] } : prev);
    fsAddPerson(receiptId, person);
  },
  [receiptId, people.length]
);
```

**Step 2: Update `updatePerson`**

Replace lines 116-119:

```ts
const updatePerson = useCallback(
  (id: string, name: string) => {
    setData(prev => prev ? {
      ...prev,
      people: prev.people.map(p => p.id === id ? { ...p, name } : p),
    } : prev);
    fsUpdatePerson(receiptId, id, name);
  },
  [receiptId]
);
```

**Step 3: Update `deletePerson`**

Replace lines 121-124:

```ts
const deletePerson = useCallback(
  (id: string) => {
    setData(prev => prev ? {
      ...prev,
      people: prev.people.filter(p => p.id !== id),
      items: prev.items.map(item => ({
        ...item,
        assignedTo: item.assignedTo.filter(pid => pid !== id),
      })),
    } : prev);
    fsDeletePerson(receiptId, id);
  },
  [receiptId]
);
```

**Step 4: Update `toggleAssignment`**

Replace lines 126-131:

```ts
const toggleAssignment = useCallback(
  (itemId: string, personId: string) => {
    setData(prev => prev ? {
      ...prev,
      items: prev.items.map(item => {
        if (item.id !== itemId) return item;
        const has = item.assignedTo.includes(personId);
        return {
          ...item,
          assignedTo: has
            ? item.assignedTo.filter(pid => pid !== personId)
            : [...item.assignedTo, personId],
        };
      }),
    } : prev);
    fsToggleAssignment(receiptId, itemId, personId);
  },
  [receiptId]
);
```

**Step 5: Build and verify**

Run: `npm run build`
Expected: Compiles successfully

**Step 6: Commit**

```bash
git add src/hooks/useFirestoreReceipt.ts
git commit -m "feat: optimistic local updates for people mutations"
```

---

### Task 3: Add optimistic updates to metadata mutations

**Files:**
- Modify: `src/hooks/useFirestoreReceipt.ts:133-146`

**Step 1: Update `setTaxTip`**

Replace lines 133-136:

```ts
const setTaxTip = useCallback(
  (updates: Partial<TaxTip>) => {
    setData(prev => prev ? {
      ...prev,
      taxTip: { ...prev.taxTip, ...updates },
    } : prev);
    fsSetTaxTip(receiptId, updates);
  },
  [receiptId]
);
```

**Step 2: Update `setRestaurantName`**

Replace lines 138-141:

```ts
const setRestaurantName = useCallback(
  (name: string | null) => {
    setData(prev => prev ? { ...prev, restaurantName: name } : prev);
    fsSetRestaurantName(receiptId, name);
  },
  [receiptId]
);
```

**Step 3: Update `setOcrText`**

Replace lines 143-146:

```ts
const setOcrText = useCallback(
  (text: string) => {
    setData(prev => prev ? { ...prev, ocrText: text } : prev);
    fsSetOcrText(receiptId, text);
  },
  [receiptId]
);
```

**Step 4: Build and run tests**

Run: `npm run build && npm test`
Expected: Build passes, all 23 tests pass

**Step 5: Commit**

```bash
git add src/hooks/useFirestoreReceipt.ts
git commit -m "feat: optimistic local updates for metadata mutations"
```
