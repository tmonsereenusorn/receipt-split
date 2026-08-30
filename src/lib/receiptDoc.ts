import { ReceiptDoc, ReceiptItem } from "@/types";

/**
 * How a receipt is stored.
 *
 * Items are keyed by id and their order is explicit, because Firestore cannot
 * address a field inside an array element — there is no `items[3].assignedTo`.
 * With an array, every edit had to read the whole array, modify it, and write it
 * back, which requires a transaction; and transactions bypass the local mutation
 * queue, so they are never reflected locally until the server answers. Keying
 * makes ordinary field-path writes possible, and those Firestore reflects the
 * instant they are issued.
 *
 * Assignments live outside the item for the same reason: they are the field
 * edited most often and most rapidly, and as their own map they can be written
 * with `arrayUnion`/`arrayRemove`, which are atomic, commutative, and idempotent.
 */
export interface StoredItem {
  name: string;
  quantity: number;
  priceCents: number;
}

export interface StoredReceiptShape {
  items: Record<string, StoredItem>;
  itemOrder: string[];
  assignments: Record<string, string[]>;
}

function isStoredItem(value: unknown): value is StoredItem {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as StoredItem).name === "string" &&
    typeof (value as StoredItem).quantity === "number" &&
    typeof (value as StoredItem).priceCents === "number"
  );
}

function isLegacyItem(value: unknown): value is ReceiptItem {
  return (
    isStoredItem(value) && typeof (value as ReceiptItem).id === "string"
  );
}

function assignedFor(
  assignments: Record<string, unknown>,
  itemId: string
): string[] {
  const entry = assignments[itemId];
  if (!Array.isArray(entry)) return [];
  return entry.filter((p): p is string => typeof p === "string");
}

/**
 * Read a stored receipt in whatever shape it is in.
 *
 * Documents written before this change store `items` as an array with
 * `assignedTo` inline. They convert here at the read boundary, so no migration
 * job is needed and a touched document self-heals when it is next written.
 *
 * The in-memory shape is unchanged — an ordered `ReceiptItem[]` — so the
 * calculator, components, and exporters are untouched by any of this.
 */
export function normalizeStoredReceipt(raw: unknown): ReceiptDoc {
  const doc = (typeof raw === "object" && raw !== null ? raw : {}) as Record<
    string,
    unknown
  >;

  const items = legacyOrKeyedItems(doc);

  return {
    restaurantName:
      typeof doc.restaurantName === "string" ? doc.restaurantName : null,
    currency: typeof doc.currency === "string" ? doc.currency : "USD",
    items,
    people: Array.isArray(doc.people) ? (doc.people as ReceiptDoc["people"]) : [],
    charges: Array.isArray(doc.charges)
      ? (doc.charges as ReceiptDoc["charges"])
      : [],
    tip: doc.tip as ReceiptDoc["tip"],
    imageDataUrl:
      typeof doc.imageDataUrl === "string" ? doc.imageDataUrl : null,
    ocrText: typeof doc.ocrText === "string" ? doc.ocrText : null,
    createdAt: typeof doc.createdAt === "number" ? doc.createdAt : 0,
  };
}

function legacyOrKeyedItems(doc: Record<string, unknown>): ReceiptItem[] {
  // Legacy: an array of items carrying their own assignedTo.
  if (Array.isArray(doc.items)) {
    return doc.items.filter(isLegacyItem).map((item) => ({
      id: item.id,
      name: item.name,
      quantity: item.quantity,
      priceCents: item.priceCents,
      assignedTo: Array.isArray(item.assignedTo) ? item.assignedTo : [],
    }));
  }

  const stored = (typeof doc.items === "object" && doc.items !== null
    ? doc.items
    : {}) as Record<string, unknown>;
  const assignments = (typeof doc.assignments === "object" &&
  doc.assignments !== null
    ? doc.assignments
    : {}) as Record<string, unknown>;
  const order = Array.isArray(doc.itemOrder)
    ? doc.itemOrder.filter((id): id is string => typeof id === "string")
    : [];

  const compose = (id: string): ReceiptItem | null => {
    const entry = stored[id];
    if (!isStoredItem(entry)) return null;
    return {
      id,
      name: entry.name,
      quantity: entry.quantity,
      priceCents: entry.priceCents,
      assignedTo: assignedFor(assignments, id),
    };
  };

  // itemOrder is a hint; items is the truth. An id in the order with no item
  // is dropped rather than rendered as a blank row, and an item missing from
  // the order is appended rather than being invisible and unrecoverable.
  const ordered = order.map(compose).filter((i): i is ReceiptItem => i !== null);
  const seen = new Set(ordered.map((i) => i.id));
  const rest = Object.keys(stored)
    .filter((id) => !seen.has(id))
    .map(compose)
    .filter((i): i is ReceiptItem => i !== null);

  return [...ordered, ...rest];
}

/** The ordered array as it is stored: keyed items, explicit order, assignments. */
export function storedFromItems(items: ReceiptItem[]): StoredReceiptShape {
  const stored: Record<string, StoredItem> = {};
  const assignments: Record<string, string[]> = {};

  for (const item of items) {
    stored[item.id] = {
      name: item.name,
      quantity: item.quantity,
      priceCents: item.priceCents,
    };
    // Empty lists are omitted rather than stored, so an unassigned item costs
    // no field and a delete leaves nothing behind.
    if (item.assignedTo.length > 0) assignments[item.id] = item.assignedTo;
  }

  return { items: stored, itemOrder: items.map((i) => i.id), assignments };
}
