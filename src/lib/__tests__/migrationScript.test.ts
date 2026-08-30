import { describe, it, expect } from "vitest";
// The real script's conversion functions. This is a destructive whole-document
// migration, and these two pure functions are the part that has to be right.
import {
  keyItems,
  moneyFromTaxTip,
} from "../../../scripts/migrate-to-keyed-items.mjs";
import { normalizeStoredReceipt } from "../receiptDoc";

/** moneyFromTaxTip returns null only when taxTip is absent, which these aren't. */
function nonNull<T>(v: T | null): T {
  if (v === null) throw new Error("expected a migration result");
  return v;
}

const legacyItem = (id: string, priceCents: number, assignedTo: string[] = []) => ({
  id,
  name: id,
  quantity: 1,
  priceCents,
  assignedTo,
});

describe("keyItems", () => {
  it("keys every item and records the original order", () => {
    const out = keyItems([legacyItem("a", 100), legacyItem("b", 200)]);

    expect(out.itemOrder).toEqual(["a", "b"]);
    expect(Object.keys(out.items).sort()).toEqual(["a", "b"]);
    expect(out.dropped).toEqual([]);
  });

  it("lifts assignedTo into the assignments map", () => {
    const out = keyItems([legacyItem("a", 100, ["p1", "p2"])]);

    expect(out.assignments).toEqual({ a: ["p1", "p2"] });
    expect("assignedTo" in out.items["a"]).toBe(false);
  });

  it("omits an empty assignment list", () => {
    expect(keyItems([legacyItem("a", 100)]).assignments).toEqual({});
  });

  it("reports an item with no usable id rather than dropping it silently", () => {
    // The caller refuses to write when this is non-empty. A silently dropped
    // item is indistinguishable from a receipt that never had it.
    const out = keyItems([legacyItem("a", 100), { name: "no id" }]);

    expect(out.dropped).toHaveLength(1);
    expect(out.itemOrder).toEqual(["a"]);
  });

  it("produces a shape the app can read back", () => {
    const items = [legacyItem("a", 100, ["p1"]), legacyItem("b", 250)];
    const { items: keyed, itemOrder, assignments } = keyItems(items);

    const read = normalizeStoredReceipt({
      items: keyed,
      itemOrder,
      assignments,
      tip: { cents: 0, isPercent: true, percent: 20 },
    });

    expect(read.items).toEqual([
      { id: "a", name: "a", quantity: 1, priceCents: 100, assignedTo: ["p1"] },
      { id: "b", name: "b", quantity: 1, priceCents: 250, assignedTo: [] },
    ]);
  });
});

describe("moneyFromTaxTip", () => {
  const base = {
    taxCents: 0,
    taxIsPercent: false,
    taxPercent: 0,
    tipCents: 0,
    tipIsPercent: false,
    tipPercent: 0,
  };

  it("returns null when there is no taxTip", () => {
    expect(moneyFromTaxTip(undefined, [])).toBeNull();
  });

  it("converts a cash tax into a Tax charge", () => {
    const out = nonNull(moneyFromTaxTip({ ...base, taxCents: 537 }, []));

    expect(out.charges).toEqual([
      { id: "charge-tax", label: "Tax", amountCents: 537 },
    ]);
  });

  it("converts a percent tax using the item subtotal", () => {
    const out = nonNull(moneyFromTaxTip(
      { ...base, taxIsPercent: true, taxPercent: 7 },
      [legacyItem("a", 6000), legacyItem("b", 4000)]
    ));

    expect(out.charges[0].amountCents).toBe(700);
  });

  it("converts a service charge", () => {
    const out = nonNull(moneyFromTaxTip({ ...base, serviceCents: 1105 }, []));

    expect(out.charges.map((c: { label: string }) => c.label)).toEqual([
      "Service Charge",
    ]);
  });

  it("produces no charge for zero-valued tax or service", () => {
    expect(moneyFromTaxTip({ ...base }, [])!.charges).toEqual([]);
  });

  it("carries the tip over intact", () => {
    const out = nonNull(moneyFromTaxTip({ ...base, tipCents: 1500 }, []));

    expect(out.tip).toEqual({ cents: 1500, isPercent: false, percent: 0 });
  });
});
