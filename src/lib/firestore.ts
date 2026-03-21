import {
  doc,
  addDoc,
  getDoc,
  updateDoc,
  collection,
  runTransaction,
  onSnapshot,
  type Unsubscribe,
  type DocumentSnapshot,
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

function requireData(snap: DocumentSnapshot): ReceiptDoc {
  if (!snap.exists()) throw new Error("Receipt not found");
  return snap.data() as ReceiptDoc;
}

function receiptRef(id: string) {
  return doc(db, COLLECTION, id);
}

/** Fetch a receipt document once (for server-side use). */
export async function getReceipt(id: string): Promise<ReceiptDoc | null> {
  const snap = await getDoc(receiptRef(id));
  return snap.exists() ? (snap.data() as ReceiptDoc) : null;
}

/** Create a new receipt document. Returns the document ID. */
export async function createReceipt(
  partial: Partial<ReceiptDoc>
): Promise<string> {
  const data: ReceiptDoc = {
    restaurantName: partial.restaurantName ?? null,
    currency: partial.currency ?? "USD",
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

/** Subscribe to real-time updates. Returns unsubscribe function. */
export function subscribeToReceipt(
  id: string,
  onData: (data: ReceiptDoc) => void,
  onError: (err: Error) => void
): Unsubscribe {
  return onSnapshot(
    receiptRef(id),
    (snap) => {
      if (!snap.exists()) {
        onError(new Error("Receipt not found"));
        return;
      }
      onData(snap.data() as ReceiptDoc);
    },
    onError
  );
}

/** Set items array (last-write-wins — existence-guarded but not merge-safe) */
export async function fsSetItems(id: string, items: ReceiptItem[]) {
  const ref = receiptRef(id);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    requireData(snap);
    tx.update(ref, { items });
  });
}

/** Atomic: add item */
export async function fsAddItem(id: string, item: ReceiptItem) {
  await runTransaction(db, async (tx) => {
    const ref = receiptRef(id);
    const snap = await tx.get(ref);
    const data = requireData(snap);
    tx.update(ref, { items: [item, ...data.items] });
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
    const data = requireData(snap);
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
    const data = requireData(snap);
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
    const data = requireData(snap);
    const items = [...data.items];
    const idx = items.findIndex((i) => i.id === itemId);
    if (idx === -1) return;
    const swap = direction === "up" ? idx - 1 : idx + 1;
    if (swap < 0 || swap >= items.length) return;
    [items[idx], items[swap]] = [items[swap], items[idx]];
    tx.update(ref, { items });
  });
}

/** Atomic: reorder item to a new index */
export async function fsReorderItem(
  id: string,
  itemId: string,
  newIndex: number
) {
  await runTransaction(db, async (tx) => {
    const ref = receiptRef(id);
    const snap = await tx.get(ref);
    const data = requireData(snap);
    const items = [...data.items];
    const oldIndex = items.findIndex((i) => i.id === itemId);
    if (oldIndex === -1) return;
    const [item] = items.splice(oldIndex, 1);
    items.splice(newIndex, 0, item);
    tx.update(ref, { items });
  });
}

/** Atomic: add person */
export async function fsAddPerson(id: string, person: Person) {
  await runTransaction(db, async (tx) => {
    const ref = receiptRef(id);
    const snap = await tx.get(ref);
    const data = requireData(snap);
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
    const data = requireData(snap);
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
    const data = requireData(snap);
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
    const data = requireData(snap);
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
    const data = requireData(snap);
    tx.update(ref, { taxTip: { ...data.taxTip, ...taxTip } });
  });
}

/** Set currency */
export async function fsSetCurrency(id: string, currency: string) {
  await updateDoc(receiptRef(id), { currency });
}

/** Set restaurant name */
export async function fsSetRestaurantName(
  id: string,
  name: string | null
) {
  await updateDoc(receiptRef(id), { restaurantName: name });
}

/** Set OCR text */
export async function fsSetOcrText(id: string, text: string | null) {
  await updateDoc(receiptRef(id), { ocrText: text });
}
