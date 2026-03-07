# Optimistic UI for Firestore Mutations

## Problem

All mutations await a Firestore round-trip (via `runTransaction`) before the UI updates. The `onSnapshot` listener is the only source of state, so every interaction has network latency.

## Solution: Optimistic Local State

Apply mutations to local React state immediately in `useFirestoreReceipt`, then fire the Firestore call without awaiting. `onSnapshot` continues to overwrite local state with server truth on every update.

### Scope

Changes only in `src/hooks/useFirestoreReceipt.ts`. No changes to `firestore.ts`, components, or Firestore security rules.

### Mutation Pattern

Each callback in the hook follows this pattern:

```ts
const updateItem = useCallback((id, updates) => {
  // 1. Optimistic local update
  setData(prev => prev ? {
    ...prev,
    items: prev.items.map(item =>
      item.id === id ? { ...item, ...updates } : item
    ),
  } : prev);
  // 2. Fire-and-forget Firestore write
  fsUpdateItem(receiptId, id, updates);
}, [receiptId]);
```

### All Mutations

| Mutation | Local transform |
|---|---|
| addItem | Prepend item to items |
| updateItem | Map items, merge updates |
| deleteItem | Filter out item |
| reorderItem | Splice item to new index |
| addPerson | Append person to people |
| updatePerson | Map people, update name |
| deletePerson | Filter person + clean assignedTo |
| toggleAssignment | Toggle personId in item's assignedTo |
| setTaxTip | Merge partial into taxTip |
| setRestaurantName | Set restaurantName |

### Error Handling

No explicit error handling. If a Firestore write fails, the next `onSnapshot` delivers server truth, naturally reverting the optimistic update.

### What Stays the Same

- All `runTransaction` calls in `firestore.ts` remain atomic
- `onSnapshot` subscription unchanged
- Component code unchanged
- No new dependencies
