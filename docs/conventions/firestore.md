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
`runTransaction` when a write truly depends on reading other state:

- `fsAddItem` — a new item goes to the top, and there is no `arrayPrepend`, so the order has to
  be rewritten. Writing it from the caller's view would let two simultaneous adds drop each
  other from the order.
- `fsDeletePerson` — removing a person also strips them from every assignment list.

Transactions get **no latency compensation**: the SDK sends them straight to the server,
bypassing the local mutation queue, so nothing appears until the server answers. That is the
cost of reaching for one unnecessarily.

## Known deviation: `people` and `charges`
Both are still arrays of objects, so `fsUpdatePerson`, `fsUpdateCharge`, `fsDeleteCharge`, and
`fsSetTip` are read-modify-write transactions and get no latency compensation. This is a known
deviation from the rule above, not an oversight: they are edited rarely and never in rapid
succession, and their inputs already hold local state while focused, so only the derived total
lags. Key them if that changes.

## Don't hand-roll optimistic state
Firestore's local cache already is the optimistic layer for `updateDoc`. A second one racing it
is a bug, not a feature.

## Surface mutation errors
Don't fire-and-forget writes. Catch and surface errors to the UI.
