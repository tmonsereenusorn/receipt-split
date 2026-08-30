# Firestore Conventions

## Guard existence in transactions
```ts
const snap = await tx.get(ref);
if (!snap.exists()) throw new Error("Receipt not found");
const data = snap.data() as ReceiptDoc;
```

## Prefer field paths and server transforms over read-modify-write
Write the field you mean, not the whole container:

```ts
updateDoc(ref, { [`assignments.${itemId}`]: arrayUnion(personId) })
updateDoc(ref, { [`items.${itemId}.name`]: name })
```

`arrayUnion`/`arrayRemove`/`increment` are applied by the server and are idempotent and
commutative, so concurrent edits converge with no retry. `updateDoc` is also applied to the
local cache the instant it is issued, so the UI reflects it with no round-trip.

**Structure data so this is possible.** Firestore cannot address a field inside an array
element, so a list that is edited field-by-field belongs in a map keyed by id with order in
its own field. An array of objects forces read-modify-write.

## Use transactions only for genuine read-modify-write
`runTransaction` when a write truly depends on reading other state — `fsSetItems` replacing the
whole list, `fsDeletePerson` also stripping that person from every assignment.

Transactions get **no latency compensation**: the SDK sends them straight to the server,
bypassing the local mutation queue, so nothing appears until the server answers. That is the
cost of reaching for one unnecessarily.

## Don't hand-roll optimistic state
Firestore's local cache already is the optimistic layer for `updateDoc`. A second one racing it
is a bug, not a feature.

## Surface mutation errors
Don't fire-and-forget writes. Catch and surface errors to the UI.
