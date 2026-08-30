import { describe, it, expect } from "vitest";
import { normalizeStoredReceipt, storedFromItems } from "../receiptDoc";
import { ReceiptItem } from "@/types";

function item(
  id: string,
  priceCents: number,
  assignedTo: string[] = []
): ReceiptItem {
  return { id, name: id, quantity: 1, priceCents, assignedTo };
}

const BASE = {
  restaurantName: null,
  currency: "USD",
  people: [],
  charges: [],
  tip: { cents: 0, isPercent: true, percent: 20 },
  imageDataUrl: null,
  ocrText: null,
  createdAt: 0,
};

describe("normalizeStoredReceipt — unsupported legacy documents", () => {
  it("reads a pre-keyed array document as empty rather than migrating it", () => {
    // Support was dropped deliberately: carrying the migration caused three
    // separate data-loss defects. Empty is visible; wrong numbers are not.
    const doc = { ...BASE, items: [item("a", 100), item("b", 200)] };

    expect(normalizeStoredReceipt(doc).items).toEqual([]);
  });
});

describe("normalizeStoredReceipt — keyed documents", () => {
  const keyed = {
    ...BASE,
    items: {
      a: { name: "a", quantity: 1, priceCents: 100 },
      b: { name: "b", quantity: 2, priceCents: 200 },
    },
    itemOrder: ["b", "a"],
    assignments: { a: ["p1"] },
  };

  it("recomposes items in itemOrder", () => {
    expect(normalizeStoredReceipt(keyed).items.map((i) => i.id)).toEqual([
      "b",
      "a",
    ]);
  });

  it("reads assignments back onto the item", () => {
    const result = normalizeStoredReceipt(keyed);

    expect(result.items.find((i) => i.id === "a")?.assignedTo).toEqual(["p1"]);
  });

  it("gives an item with no assignments an empty list", () => {
    const result = normalizeStoredReceipt(keyed);

    expect(result.items.find((i) => i.id === "b")?.assignedTo).toEqual([]);
  });

  it("drops an id in itemOrder that has no item", () => {
    // A concurrent delete can remove the item before the order write lands.
    // Rendering an empty row would be worse than rendering nothing.
    const doc = { ...keyed, itemOrder: ["b", "ghost", "a"] };

    expect(normalizeStoredReceipt(doc).items.map((i) => i.id)).toEqual([
      "b",
      "a",
    ]);
  });

  it("appends an item missing from itemOrder rather than losing it", () => {
    // itemOrder is a hint; items is the truth. An add whose order write failed
    // must still show up, or the item is invisible and unrecoverable.
    const doc = { ...keyed, itemOrder: ["a"] };

    expect(normalizeStoredReceipt(doc).items.map((i) => i.id)).toEqual([
      "a",
      "b",
    ]);
  });

  it("drops a malformed item entry rather than failing the read", () => {
    const doc = {
      ...keyed,
      items: { ...keyed.items, bad: { name: 5, quantity: "x" } },
      itemOrder: ["a", "bad", "b"],
    };

    expect(normalizeStoredReceipt(doc).items.map((i) => i.id)).toEqual([
      "a",
      "b",
    ]);
  });

  it("tolerates a non-array assignments value", () => {
    const doc = { ...keyed, assignments: { a: "p1" } };

    expect(normalizeStoredReceipt(doc).items[1].assignedTo).toEqual([]);
  });
});

describe("storedFromItems", () => {
  it("keys items by id and records their order", () => {
    const stored = storedFromItems([item("a", 100), item("b", 200)]);

    expect(Object.keys(stored.items).sort()).toEqual(["a", "b"]);
    expect(stored.itemOrder).toEqual(["a", "b"]);
  });

  it("moves assignedTo into the assignments map", () => {
    const stored = storedFromItems([item("a", 100, ["p1"])]);

    expect(stored.assignments).toEqual({ a: ["p1"] });
    expect("assignedTo" in stored.items.a).toBe(false);
  });

  it("omits an empty assignment list rather than storing an empty array", () => {
    const stored = storedFromItems([item("a", 100)]);

    expect(stored.assignments).toEqual({});
  });

  it("round-trips through normalizeStoredReceipt", () => {
    const items = [item("a", 100, ["p1", "p2"]), item("b", 200), item("c", 300, ["p3"])];

    const result = normalizeStoredReceipt({ ...BASE, ...storedFromItems(items) });

    expect(result.items).toEqual(items);
  });
});

describe("non-finite stored numbers", () => {
  // typeof NaN === "number", so a poisoned value would pass a bare typeof check
  // and make every total NaN. Nothing writes one today; this is the boundary's
  // job regardless of who is upstream.
  const base = {
    itemOrder: ["a", "b"],
    assignments: {},
    tip: { cents: 0, isPercent: true, percent: 20 },
  };

  it("drops an item whose price is NaN", () => {
    const doc = {
      ...base,
      items: {
        a: { name: "a", quantity: 1, priceCents: NaN },
        b: { name: "b", quantity: 1, priceCents: 100 },
      },
    };

    expect(normalizeStoredReceipt(doc).items.map((i) => i.id)).toEqual(["b"]);
  });

  it("drops an item whose quantity is Infinity", () => {
    const doc = {
      ...base,
      items: {
        a: { name: "a", quantity: Infinity, priceCents: 100 },
        b: { name: "b", quantity: 1, priceCents: 100 },
      },
    };

    expect(normalizeStoredReceipt(doc).items.map((i) => i.id)).toEqual(["b"]);
  });
});
