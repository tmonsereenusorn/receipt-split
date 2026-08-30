# Live Edit Races — Design

**Date:** 2026-08-29
**Status:** Approved

## Problem

Assigning a person to an item frequently reverts a moment later, on a single user's own
instance with nobody else editing.

## Root cause

Two defects compound, and both trace to one schema decision.

**1. Optimistic edits are discarded by the listener.** `subscribeToReceipt` replaces state on
every snapshot, unconditionally, never inspecting `snap.metadata`. The hook applies an
optimistic `setData` and then dispatches a mutation, so between the click and the server
acknowledgement the edit exists only in React state. Any snapshot landing in that window
overwrites it with server data that predates the click.

That window is a full server round-trip, because **every mutation is a `runTransaction`**, and
transactions have no latency compensation. From the SDK source: transaction `commit()` sends
mutations to the server via `invokeCommitRpc`, *bypassing localStore, the mutation queue, and
syncEngineWrite entirely; no local optimistic updates are applied.*

**2. Assignment writes are non-idempotent.** `fsToggleAssignment` computes the toggle from
server state, so once the UI has wrongly reverted, the user's natural re-click removes rather
than re-adds:

```
click Alice     -> UI ["Alice"]        optimistic
  snapshot      -> UI []               stale snapshot clobbers it
  commit Alice  -> server ["Alice"]    first transaction lands
click Alice     -> UI ["Alice"]        user re-clicks, believing it failed
  commit Alice  -> server []           toggle sees Alice present, removes her
  snapshot      -> UI []               permanently lost
```

**Why transactions were used at all: the schema.** `items` is an array of objects, and Firestore
cannot address a field inside an array element — there is no `items[3].assignedTo`. Every edit
therefore had to read the whole array, modify it, and write it back, which requires a
transaction for safety. The transaction is not the disease; it is the symptom of a schema that
is not field-addressable.

## Approach

Fix the schema so ordinary writes become possible, then delete the machinery that existed to
work around not having them.

**1. Make every edited thing addressable by field path.**

```ts
items: { [itemId]: { name, quantity, priceCents } }   // keyed, not an array
itemOrder: string[]                                    // order made explicit
assignments: { [itemId]: string[] }                    // pulled out of the item
```

**2. Use commutative server-side transforms instead of read-modify-write.**

```ts
assign:   updateDoc(ref, { [`assignments.${itemId}`]: arrayUnion(personId) })
unassign: updateDoc(ref, { [`assignments.${itemId}`]: arrayRemove(personId) })
rename:   updateDoc(ref, { [`items.${itemId}.name`]: name })
reorder:  updateDoc(ref, { itemOrder })
```

`arrayUnion`/`arrayRemove` are applied by the server and are idempotent and commutative: two
people assigning different diners to the same item both succeed, with no contention retry. A
transaction would have forced one to retry. This is the same property CRDTs rely on — add and
remove over a set converge; rewriting a whole array does not.

**3. Then instant reflection is free, and code gets deleted.** Per the Firestore docs,
`updateDoc` *"utilises latency compensation… the data is immediately saved to the local cache
and reflected in future get operations, even if the client is offline."* The listener fires
immediately with `hasPendingWrites: true`.

So the optimistic `setData` in every mutation, and the pending-edit replay an earlier draft of
this document proposed, are both **removed**. Firestore already does that work; the app was
reimplementing it badly because the schema forced transactions, which opt out of it.

## What stays a transaction

`people` and `charges` remain arrays of objects — moving them to keyed maps is out of scope
below — so their read-modify-write mutations cannot become field-path writes and keep their
transactions: `fsUpdatePerson`, `fsUpdateCharge`, `fsDeleteCharge`, and `fsSetTip`.

`fsAddItem` and `fsDeletePerson` stay transactions for a stronger reason. Adding an item
prepends — the blank row is meant to be typed into — and there is no `arrayPrepend`, so the
order must be rewritten; doing that from the caller's view would let two simultaneous adds drop
each other from the order. Deleting a person must also strip them from every assignment list,
which is not expressible as independent field writes.

**These five lose their instant feedback**, because the hand-rolled optimistic layer is being
deleted and transactions get none from Firestore. That is acceptable here: all five are edited
rarely and never in the rapid succession that makes assignment race, and the inputs that drive
them already hold their own local state while focused, so only the derived total lags. Everything
on the hot path — assigning, adding, renaming, deleting, reordering items — becomes a field-path
`updateDoc` and is instant.

## Backward compatibility

Stored receipts have `items` as an array and no `itemOrder` or `assignments`. Convert at the
Firestore read boundary, as with the charges migration: `normalizeReceiptDoc` maps a legacy
array to `{ items, itemOrder, assignments }`, deriving order from the array's own order and
lifting each item's `assignedTo` into the assignments map. Writes go through the new shape, so a
touched document self-heals. No migration job.

The in-memory shape stays an ordered `ReceiptItem[]` with `assignedTo` — the calculator, the
components, and the exporters are unchanged. Only the stored shape and the write paths change,
so the split math and its tests are untouched.

## Testing

- **`normalizeReceiptDoc`** — legacy array yields items keyed by id, order matching the array,
  and assignments lifted from each `assignedTo`; a new-shape document passes through; an item in
  `itemOrder` but missing from `items` is dropped; an item present but absent from `itemOrder` is
  appended rather than lost
- **`toReceiptItems`** — the keyed shape recomposes into the ordered array the app renders
- **Idempotence** — assigning twice equals assigning once; unassigning someone not assigned is a
  no-op. These are the properties `arrayUnion`/`arrayRemove` guarantee, pinned so a later
  refactor cannot quietly reintroduce read-modify-write
- **The reported sequence** — assign, stale snapshot, re-click: the person stays assigned

## Mutation errors

Mutations are dispatched fire-and-forget, so a rejected write is an unhandled rejection the user
never sees (`docs/code-quality-review.md` §4). With latency compensation the local cache has
already applied the change, so a permanent failure silently diverges the UI from the server. The
write helper now catches and surfaces through the hook's existing `error` state.

## Out of scope

- Moving `people` or `charges` to keyed maps. They are edited rarely and not concurrently.
- Retrying a failed write.
