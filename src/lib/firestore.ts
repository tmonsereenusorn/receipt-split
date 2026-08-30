import { isValidChargeAmount, normalizeReceiptMoney } from "./charges";
import { normalizeStoredReceipt, storedFromItems } from "./receiptDoc";
import {
  doc,
  addDoc,
  getDoc,
  updateDoc,
  deleteField,
  arrayUnion,
  arrayRemove,
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
  Tip,
  initialTip,
  ReceiptCharge,
} from "@/types";

const COLLECTION = "receipts";

function requireData(snap: DocumentSnapshot): ReceiptDoc {
  if (!snap.exists()) throw new Error("Receipt not found");
  return normalizeStoredReceipt(snap.data());
}

function receiptRef(id: string) {
  return doc(db, COLLECTION, id);
}

/** Fetch a receipt document once (for server-side use). */
export async function getReceipt(id: string): Promise<ReceiptDoc | null> {
  const snap = await getDoc(receiptRef(id));
  // Normalized, not cast: stored `items` is a keyed map, so returning it behind
  // a type that says ReceiptItem[] was a lie the compiler could not catch. Only
  // generateMetadata reads this today, and only restaurantName, so nothing broke
  // — the next caller to touch `items` would have.
  return snap.exists() ? normalizeStoredReceipt(snap.data()) : null;
}

/** Create a new receipt document. Returns the document ID. */
export async function createReceipt(
  partial: Partial<ReceiptDoc>
): Promise<string> {
  const { items, itemOrder, assignments } = storedFromItems(partial.items ?? []);
  const data = {
    restaurantName: partial.restaurantName ?? null,
    currency: partial.currency ?? "USD",
    items,
    itemOrder,
    assignments,
    people: partial.people ?? [],
    charges: partial.charges ?? [],
    tip: partial.tip ?? initialTip,
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
      onData(normalizeStoredReceipt(snap.data()));
    },
    onError
  );
}

/**
 * Every mutation below is a field-path `updateDoc`, not a transaction.
 *
 * `updateDoc` is applied to the local cache the instant it is issued and the
 * listener fires immediately, so the UI reflects the edit with no round-trip and
 * no hand-rolled optimistic state. A transaction gets none of that: the SDK
 * sends it straight to the server, bypassing the local mutation queue.
 *
 * `arrayUnion`/`arrayRemove` are applied by the server and are idempotent and
 * commutative, so two people editing the same item converge without either
 * write being retried.
 */

/**
 * A new item goes to the TOP, as it always has — the blank row is meant to be
 * typed into immediately, and appending would put it below the fold on a long
 * receipt.
 *
 * That makes this a genuine read-modify-write and so a transaction, per
 * docs/conventions/firestore.md: `arrayUnion` can only append, so prepending
 * means rewriting the order, and writing it from the caller's stale view would
 * let two simultaneous adds drop each other from the order — the item would
 * survive but land at the bottom, which is the placement this exists to avoid.
 *
 * The cost is that adding an item waits for the server, unlike assigning. That
 * is the right way round: assignment is the rapid, repeated action.
 */
export async function fsAddItem(id: string, item: ReceiptItem) {
  const { id: itemId, assignedTo, ...fields } = item;
  await runTransaction(db, async (tx) => {
    const ref = receiptRef(id);
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error("Receipt not found");
    const raw = snap.data() as { itemOrder?: unknown };
    const order = Array.isArray(raw.itemOrder)
      ? raw.itemOrder.filter((i): i is string => typeof i === "string")
      : [];
    tx.update(ref, {
      [`items.${itemId}`]: fields,
      itemOrder: [itemId, ...order.filter((i) => i !== itemId)],
      ...(assignedTo.length > 0 && { [`assignments.${itemId}`]: assignedTo }),
    });
  });
}

export async function fsUpdateItem(
  id: string,
  itemId: string,
  updates: Partial<Omit<ReceiptItem, "id">>
) {
  const { assignedTo, ...fields } = updates;
  const patch: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(fields)) {
    patch[`items.${itemId}.${key}`] = value;
  }
  if (assignedTo) patch[`assignments.${itemId}`] = assignedTo;
  if (Object.keys(patch).length === 0) return;
  await updateDoc(receiptRef(id), patch);
}

export async function fsDeleteItem(id: string, itemId: string) {
  await updateDoc(receiptRef(id), {
    [`items.${itemId}`]: deleteField(),
    [`assignments.${itemId}`]: deleteField(),
    itemOrder: arrayRemove(itemId),
  });
}

/** Order is its own field, so reordering is a single write of that field. */
export async function fsSetItemOrder(id: string, itemOrder: string[]) {
  await updateDoc(receiptRef(id), { itemOrder });
}

/**
 * Set whether a person is assigned, rather than flipping it.
 *
 * Intent, not a delta: a duplicate click is a no-op instead of a reversal. The
 * old toggle computed the flip from server state, so once the UI had reverted
 * for any reason a re-click removed the person instead of re-adding them.
 */
export async function fsSetAssignment(
  id: string,
  itemId: string,
  personId: string,
  assigned: boolean
) {
  await updateDoc(receiptRef(id), {
    [`assignments.${itemId}`]: assigned
      ? arrayUnion(personId)
      : arrayRemove(personId),
  });
}

export async function fsAddPerson(id: string, person: Person) {
  await updateDoc(receiptRef(id), { people: arrayUnion(person) });
}

export async function fsUpdatePerson(id: string, personId: string, name: string) {
  await runTransaction(db, async (tx) => {
    const ref = receiptRef(id);
    const snap = await tx.get(ref);
    const data = requireData(snap);
    tx.update(ref, {
      people: (data.people ?? []).map((p) =>
        p.id === personId ? { ...p, name } : p
      ),
    });
  });
}

/**
 * The one mutation that still needs a transaction: removing a person also has
 * to strip them from every assignment list, which cannot be expressed as a set
 * of independent field writes.
 */
export async function fsDeletePerson(id: string, personId: string) {
  await runTransaction(db, async (tx) => {
    const ref = receiptRef(id);
    const snap = await tx.get(ref);
    const raw = snap.data() as Record<string, unknown> | undefined;
    if (!raw) throw new Error("Receipt not found");

    const doc = normalizeStoredReceipt(raw);
    const patch: Record<string, unknown> = {
      people: doc.people.filter((p) => p.id !== personId),
    };
    for (const item of doc.items) {
      if (item.assignedTo.includes(personId)) {
        patch[`assignments.${item.id}`] = item.assignedTo.filter(
          (pid) => pid !== personId
        );
      }
    }
    tx.update(ref, patch);
  });
}

export async function fsAddCharge(id: string, charge: ReceiptCharge) {
  if (!isValidChargeAmount(charge.amountCents)) {
    throw new Error("Charge amount out of range");
  }
  await updateDoc(receiptRef(id), { charges: arrayUnion(charge) });
}

export async function fsUpdateCharge(
  id: string,
  chargeId: string,
  updates: Partial<Omit<ReceiptCharge, "id">>
) {
  if (
    updates.amountCents !== undefined &&
    !isValidChargeAmount(updates.amountCents)
  ) {
    throw new Error("Charge amount out of range");
  }
  await runTransaction(db, async (tx) => {
    const ref = receiptRef(id);
    const snap = await tx.get(ref);
    const raw = snap.data();
    if (!raw) throw new Error("Receipt not found");
    const { charges, tip } = normalizeReceiptMoney(raw);
    tx.update(ref, {
      charges: charges.map((c) => (c.id === chargeId ? { ...c, ...updates } : c)),
      tip,
    });
  });
}

export async function fsDeleteCharge(id: string, chargeId: string) {
  await runTransaction(db, async (tx) => {
    const ref = receiptRef(id);
    const snap = await tx.get(ref);
    const raw = snap.data();
    if (!raw) throw new Error("Receipt not found");
    const { charges, tip } = normalizeReceiptMoney(raw);
    tx.update(ref, { charges: charges.filter((c) => c.id !== chargeId), tip });
  });
}

export async function fsSetTip(id: string, updates: Partial<Tip>) {
  await runTransaction(db, async (tx) => {
    const ref = receiptRef(id);
    const snap = await tx.get(ref);
    const raw = snap.data();
    if (!raw) throw new Error("Receipt not found");
    const { charges, tip } = normalizeReceiptMoney(raw);
    tx.update(ref, { charges, tip: { ...tip, ...updates } });
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
