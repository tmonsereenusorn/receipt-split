# Firestore Conventions

## Guard existence in transactions
```ts
const snap = await tx.get(ref);
if (!snap.exists()) throw new Error("Receipt not found");
const data = snap.data() as ReceiptDoc;
```

## Use transactions for read-modify-write
Don't use `updateDoc` when the write depends on current document state. Use `runTransaction`.

## Surface mutation errors
Don't fire-and-forget writes. Catch and surface errors to the UI.
