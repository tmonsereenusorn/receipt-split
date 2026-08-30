# Live Edit Races — Design

**Date:** 2026-08-29
**Status:** Approved

## Problem

Assigning a person to an item frequently reverts a moment later, on a single user's own
instance with nobody else editing.

## Root cause

Two defects compound.

**1. The listener has no concept of in-flight local writes.** `subscribeToReceipt`
(`src/lib/firestore.ts`) replaces state on every snapshot, unconditionally:

```ts
onSnapshot(receiptRef(id), (snap) => onData(snap.data() as ReceiptDoc));
```

It never inspects `snap.metadata`. The hook applies an optimistic `setData` and then calls a
mutation, so between the click and the server acknowledgement the optimistic edit exists only
in React state. Any snapshot landing in that window overwrites it with server data that
predates the click.

That window is a full server round-trip, because **every mutation is a `runTransaction`** and
transactions have no latency compensation. From the Firebase SDK's own source: transaction
`commit()` sends mutations directly to the server via `invokeCommitRpc`, *bypassing localStore,
the mutation queue, and syncEngineWrite entirely; no local optimistic updates are applied.* A
plain `updateDoc` would echo a local snapshot immediately with `hasPendingWrites: true`; a
transaction echoes nothing.

Seventeen of the twenty mutations in `firestore.ts` are transactions, so snapshots are frequent
and the window is hit constantly.

**2. Assignment writes are non-idempotent.** `fsToggleAssignment` computes the toggle from
server state. Once defect 1 has made the UI revert, the user's natural re-click does not re-add
— it removes:

```
click Alice     -> UI ["Alice"]        optimistic
  snapshot      -> UI []               stale snapshot clobbers it
  commit Alice  -> server ["Alice"]    first transaction lands
click Alice     -> UI ["Alice"]        user re-clicks, believing it failed
  commit Alice  -> server []           toggle sees Alice present, removes her
  snapshot      -> UI []               permanently lost
```

Defect 1 alone is a flicker. Defect 2 turns it into data loss.

## Approach

**Write intent, not deltas.** `fsToggleAssignment(itemId, personId)` becomes
`fsSetAssignment(itemId, personId, assigned: boolean)`. The client already knows what it wants;
sending the desired state makes a duplicate click a no-op instead of a reversal.

**Replay pending edits over server truth.** The hook keeps the local transforms for writes that
have not yet been acknowledged. On every snapshot it applies server data and then re-applies
those pending transforms on top, rather than discarding them.

Replay is only safe because the transforms are idempotent, which is what intent-based writes
buy: re-applying "Alice is assigned" to a server document that already says so changes nothing.
The two fixes are not independent — the second is what makes the first correct.

**One transform, both sides.** The same pure function produces the optimistic update and the
value written inside the transaction, so the client's prediction and the server's result cannot
drift.

## Implementation

**`src/lib/liveEdit.ts`** — pure, and therefore testable; Vitest runs in the `node` environment
with no jsdom, so neither the hook nor a component can be.

```ts
/** A pending local edit, replayable over any document. */
export type PendingEdit = (doc: ReceiptDoc) => ReceiptDoc;

/** Server truth with un-acknowledged local edits re-applied on top. */
export function applyPendingEdits(doc: ReceiptDoc, edits: PendingEdit[]): ReceiptDoc;

/** Idempotent: sets whether a person is assigned, rather than flipping it. */
export function setAssignment(
  doc: ReceiptDoc,
  itemId: string,
  personId: string,
  assigned: boolean
): ReceiptDoc;
```

**`src/lib/firestore.ts`** — `fsToggleAssignment` is replaced by `fsSetAssignment`, which applies
`setAssignment` inside the transaction. The transaction stays: it is still what makes concurrent
edits from two people safe. The problem was never the transaction, it was the missing
reconciliation around it.

**`src/hooks/useFirestoreReceipt.ts`** — a `pendingEdits` ref, and a helper that registers an
edit, applies it optimistically, dispatches the write, and removes it once the write settles.
The subscribe callback becomes `setData(applyPendingEdits(serverDoc, pendingEdits.current))`.

## Mutation errors

The mutations are dispatched fire-and-forget — no `await`, no `catch` — so a rejected write is
an unhandled rejection and the user sees nothing. Already recorded in
`docs/code-quality-review.md` §4, and it interacts with this work: a failed write must also drop
its pending edit, or the UI would keep showing an edit that never landed.

The write helper therefore catches, removes the pending edit, and surfaces a message through the
hook's existing `error` state.

## Testing

- **`setAssignment`** — assigning is idempotent (twice equals once); unassigning is idempotent;
  assigning then unassigning returns the original; an unknown item or person is a no-op; other
  items are untouched
- **`applyPendingEdits`** — no edits returns the document unchanged; edits apply in order; a
  pending edit survives a server document that lacks it; a pending edit that the server has
  already applied does not double-apply (the idempotence that makes replay safe)
- **The reported sequence, as a regression test** — optimistic assign, stale snapshot, commit,
  re-click, commit: the person remains assigned

## Out of scope

- Restructuring assignments into a map field (`assignments.<itemId>`) so writes could use
  `arrayUnion`/`arrayRemove` and get Firestore's own latency compensation. It would remove the
  need for replay entirely, but it is a third schema migration in as many changes, and it is not
  needed to fix this bug.
- Retrying a failed write. It surfaces and drops its pending edit; re-trying is the user's call.
