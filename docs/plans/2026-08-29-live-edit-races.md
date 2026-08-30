# Live Edit Races — Implementation Plan

**Goal:** Stop assignments reverting, by making the stored schema field-addressable so writes become ordinary latency-compensated `updateDoc` calls instead of read-modify-write transactions.

**Architecture:** The stored document keys items and assignments by id and makes order explicit. A conversion layer at the Firestore boundary maps that to the ordered `ReceiptItem[]` the app already renders, so the calculator, components, and exporters are untouched. Writes become field-path `updateDoc` with `arrayUnion`/`arrayRemove`, which Firestore reflects locally the instant they are issued — so the hand-rolled optimistic `setData` in all 17 hook mutations is **deleted**, not extended.

**Spec:** `docs/plans/2026-08-29-live-edit-races-design.md`

**Execution:** inline, TDD per task, one commit per task.

## Global Constraints

- The **in-memory** shape does not change: `ReceiptItem[]` with `assignedTo`. Only the stored shape and the write paths do. If a change reaches `calculator.ts`, `format.ts`, or the receipt components, it has gone too far.
- Writes use field paths and server transforms. A `runTransaction` is only justified when a write genuinely depends on reading other state — `fsDeletePerson` is the sole case.
- No optimistic `setData`. Firestore's latency compensation is the mechanism; a second one racing it is the bug being fixed.
- Legacy documents convert at the read boundary; writes self-heal. No migration job.
- `docs/conventions/general.md`: validate at boundaries; no test-only exports.
- Suite is 136 tests, green. Keep it green at every commit. eslint stays at 8.

## File map

| File | Change |
| --- | --- |
| `src/lib/receiptDoc.ts` | **new** — `StoredReceipt`, `toReceiptItems`, `normalizeStoredReceipt`, `storedFromItems` |
| `src/lib/__tests__/receiptDoc.test.ts` | **new** |
| `src/lib/firestore.ts` | mutations become field-path `updateDoc`; `subscribeToReceipt` normalizes; `createReceipt` writes the new shape |
| `src/hooks/useFirestoreReceipt.ts` | delete every optimistic `setData`; surface write failures |

---

## Task 1 — The conversion layer

**Files:** `src/lib/receiptDoc.ts`, `src/lib/__tests__/receiptDoc.test.ts`

**Produces:**

```ts
export interface StoredReceipt {
  items: Record<string, { name: string; quantity: number; priceCents: number }>;
  itemOrder: string[];
  assignments: Record<string, string[]>;
  // …the unchanged fields: restaurantName, currency, people, charges, tip, …
}

/** Stored shape (new or legacy) → the ordered array the app renders. */
export function normalizeStoredReceipt(raw: unknown): ReceiptDoc;

/** Ordered array → stored shape, for createReceipt and for whole-list writes. */
export function storedFromItems(items: ReceiptItem[]): Pick<
  StoredReceipt,
  "items" | "itemOrder" | "assignments"
>;
```

- [ ] Write failing tests:
  - **legacy**: an `items` array yields the same items in the same order, with each `assignedTo` lifted into `assignments`
  - **new shape**: keyed items plus `itemOrder` recompose in order, with `assignedTo` read back from `assignments`
  - an id in `itemOrder` with no entry in `items` is **dropped**, not rendered as an empty row
  - an id in `items` missing from `itemOrder` is **appended**, not lost — order is a hint, `items` is the truth
  - an item with no assignments entry gets `assignedTo: []`
  - `storedFromItems` round-trips: `normalizeStoredReceipt(storedFromItems(xs))` returns `xs`
  - a malformed item entry is dropped rather than crashing the read
- [ ] Run, confirm failures (module missing).
- [ ] Implement.
- [ ] Commit: `feat: add the stored-receipt conversion layer`.

## Task 2 — Field-path writes

**Files:** `src/lib/firestore.ts`

Each mutation loses its transaction and becomes a field-path `updateDoc`.

| Mutation | Becomes |
| --- | --- |
| `fsToggleAssignment` → **`fsSetAssignment(id, itemId, personId, assigned)`** | `{ [assignments.<itemId>]: assigned ? arrayUnion(personId) : arrayRemove(personId) }` |
| `fsAddItem` | `{ [items.<id>]: fields, itemOrder: arrayUnion(id) }` |
| `fsUpdateItem` | one field path per changed key, e.g. `{ [items.<id>.name]: name }` |
| `fsDeleteItem` | `{ [items.<id>]: deleteField(), [assignments.<id>]: deleteField(), itemOrder: arrayRemove(id) }` |
| `fsMoveItem`, `fsReorderItem`, `fsSetItems` | `{ itemOrder: [...] }` (plus `items`/`assignments` for `fsSetItems`) |
| `fsAddPerson`, `fsUpdatePerson` | `people` stays an array; `arrayUnion` for add, field path for rename |
| charge and tip mutations | unchanged in shape, but `updateDoc` rather than `runTransaction` |
| **`fsDeletePerson`** | **stays a transaction** — it must also strip the person from every assignment list |

- [ ] `subscribeToReceipt` returns `normalizeStoredReceipt(snap.data())`.
- [ ] `createReceipt` writes `storedFromItems(...)` plus the unchanged fields.
- [ ] Verify `npx tsc --noEmit`; the hook will fail to compile until Task 3.
- [ ] Commit: `feat: write receipts by field path instead of read-modify-write`.

## Task 3 — Delete the optimistic layer

**Files:** `src/hooks/useFirestoreReceipt.ts`

- [ ] Remove the optimistic `setData(prev => …)` from **all 17** mutations. Firestore's local cache is now the optimistic layer, and the listener already fires immediately.
- [ ] `toggleAssignment(itemId, personId)` keeps its signature — the UI still asks to flip — but computes the intent from current state and calls `fsSetAssignment(…, assigned)`, so a duplicate click is a no-op rather than a reversal.
- [ ] Route write failures into the existing `error` state instead of dropping the promise. With latency compensation the cache has already applied the change, so a permanent failure would otherwise diverge the UI from the server silently.
- [ ] Verify `npm test`, `npx tsc --noEmit`, `npm run build`, eslint 8.
- [ ] Commit: `fix: let Firestore own optimistic state`.

## Task 4 — Verification

- [ ] Re-run the interleaving simulation from the diagnosis against the new write semantics: assign, stale snapshot, re-click → the person stays assigned.
- [ ] Build, start on a free port, confirm the scan path and receipt page still work end to end.
- [ ] Confirm by reading that no `setData(prev` remains in the hook, and that the only remaining transactions are the five whose fields are not addressable (see below).
- [ ] Stop the server (`pkill -f "next-server"`).
- [ ] Final: `npm test`, `npx tsc --noEmit`, `npm run build`, eslint 8, `git status --short` empty.
- [ ] Push and open a PR. Do not merge.

## Verification checklist

- [ ] Assigning is idempotent — a duplicate click cannot unassign
- [ ] No optimistic `setData` anywhere in the hook
- [ ] Transactions remain only where the edited field is not addressable
- [ ] Legacy array documents read correctly; a touched document self-heals
- [ ] `calculator.ts`, `format.ts`, and the receipt components are unchanged
- [ ] Write failures reach the user
