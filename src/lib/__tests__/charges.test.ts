import { describe, it, expect } from "vitest";
import {
  normalizeReceiptMoney,
  chargesFromExtraction,
  makeChargeId,
} from "../charges";
import { initialTip, ReceiptItem } from "@/types";

function items(...prices: number[]): ReceiptItem[] {
  return prices.map((priceCents, i) => ({
    id: `i${i}`,
    name: `i${i}`,
    quantity: 1,
    priceCents,
    assignedTo: [],
  }));
}

const LEGACY_BASE = {
  taxCents: 0,
  taxIsPercent: false,
  taxPercent: 0,
  tipCents: 0,
  tipIsPercent: false,
  tipPercent: 0,
};

describe("normalizeReceiptMoney", () => {
  it("passes a new-shape document through unchanged", () => {
    const doc = {
      charges: [{ id: "c1", label: "Tax", amountCents: 537 }],
      tip: { cents: 0, isPercent: true, percent: 20 },
    };

    const result = normalizeReceiptMoney(doc, items(10000));

    expect(result.charges).toEqual([{ id: "c1", label: "Tax", amountCents: 537 }]);
    expect(result.tip).toEqual({ cents: 0, isPercent: true, percent: 20 });
  });

  it("returns defaults for an absent map", () => {
    expect(normalizeReceiptMoney(undefined, [])).toEqual({
      charges: [],
      tip: initialTip,
    });
  });

  it("returns defaults for null", () => {
    expect(normalizeReceiptMoney(null, [])).toEqual({
      charges: [],
      tip: initialTip,
    });
  });

  it("converts a legacy cash tax into a Tax charge", () => {
    const doc = { taxTip: { ...LEGACY_BASE, taxCents: 537 } };

    const result = normalizeReceiptMoney(doc, items(10000));

    expect(result.charges).toEqual([
      { id: makeChargeId("Tax"), label: "Tax", amountCents: 537 },
    ]);
  });

  it("converts a legacy percent tax to exact cash using the stored items", () => {
    // 7% of a 10000 subtotal. The amount freezes here: it no longer rescales
    // when an item is edited, which is the new model's intent.
    const doc = {
      taxTip: { ...LEGACY_BASE, taxIsPercent: true, taxPercent: 7 },
    };

    const result = normalizeReceiptMoney(doc, items(6000, 4000));

    expect(result.charges).toEqual([
      { id: makeChargeId("Tax"), label: "Tax", amountCents: 700 },
    ]);
  });

  it("converts a legacy service charge into a Service Charge charge", () => {
    const doc = {
      taxTip: { ...LEGACY_BASE, serviceCents: 1105 },
    };

    const result = normalizeReceiptMoney(doc, items(10000));

    expect(result.charges).toEqual([
      {
        id: makeChargeId("Service Charge"),
        label: "Service Charge",
        amountCents: 1105,
      },
    ]);
  });

  it("orders migrated charges tax before service", () => {
    const doc = {
      taxTip: { ...LEGACY_BASE, taxCents: 537, serviceCents: 1105 },
    };

    const result = normalizeReceiptMoney(doc, items(10000));

    expect(result.charges.map((c) => c.label)).toEqual([
      "Tax",
      "Service Charge",
    ]);
  });

  it("produces no charge for a zero-valued legacy tax or service", () => {
    const doc = {
      taxTip: { ...LEGACY_BASE, taxCents: 0, serviceCents: 0 },
    };

    const result = normalizeReceiptMoney(doc, items(10000));

    expect(result.charges).toEqual([]);
  });

  it("produces no charge for a legacy 0% tax", () => {
    const doc = {
      taxTip: { ...LEGACY_BASE, taxIsPercent: true, taxPercent: 0 },
    };

    const result = normalizeReceiptMoney(doc, items(10000));

    expect(result.charges).toEqual([]);
  });

  it("carries a legacy percent tip over intact", () => {
    const doc = {
      taxTip: { ...LEGACY_BASE, tipIsPercent: true, tipPercent: 18 },
    };

    const result = normalizeReceiptMoney(doc, items(10000));

    expect(result.tip).toEqual({ cents: 0, isPercent: true, percent: 18 });
  });

  it("carries a legacy cash tip over intact", () => {
    const doc = { taxTip: { ...LEGACY_BASE, tipCents: 1250 } };

    const result = normalizeReceiptMoney(doc, items(10000));

    expect(result.tip).toEqual({ cents: 1250, isPercent: false, percent: 0 });
  });

  it("mints the same id across repeated calls on the same input", () => {
    const doc = { taxTip: { ...LEGACY_BASE, taxCents: 537 } };

    const a = normalizeReceiptMoney(doc, items(10000));
    const b = normalizeReceiptMoney(doc, items(10000));

    expect(a.charges[0].id).toBe(b.charges[0].id);
  });

  it("drops a stored charge that is malformed", () => {
    const doc = {
      charges: [
        { id: "c1", label: "Tax", amountCents: 537 },
        { id: "c2", label: "", amountCents: 100 },
        { id: "c3", label: "Bad", amountCents: "x" },
      ],
      tip: initialTip,
    };

    const result = normalizeReceiptMoney(doc, items(10000));

    expect(result.charges.map((c) => c.id)).toEqual(["c1"]);
  });
});

describe("chargesFromExtraction", () => {
  it("returns no overrides when the receipt reported nothing", () => {
    expect(chargesFromExtraction({ charges: [], tipCents: null })).toBeNull();
  });

  it("maps extracted charges to stored charges with ids", () => {
    const result = chargesFromExtraction({
      charges: [{ label: "Service Charge", amountCents: 1105 }],
      tipCents: null,
    });

    expect(result?.charges).toEqual([
      {
        id: makeChargeId("Service Charge", 0),
        label: "Service Charge",
        amountCents: 1105,
      },
    ]);
  });

  it("gives distinct ids to two charges sharing a label", () => {
    const result = chargesFromExtraction({
      charges: [
        { label: "Fee", amountCents: 100 },
        { label: "Fee", amountCents: 200 },
      ],
      tipCents: null,
    });

    const ids = result?.charges.map((c) => c.id) ?? [];
    expect(new Set(ids).size).toBe(2);
  });

  it("maps a parsed tip to fixed cash", () => {
    const result = chargesFromExtraction({ charges: [], tipCents: 1250 });

    // percent keeps the default so toggling to % offers the suggestion rather
    // than 0%; the amount itself comes from cents with isPercent false.
    expect(result?.tip).toEqual({
      cents: 1250,
      isPercent: false,
      percent: initialTip.percent,
    });
  });

  it("leaves the tip untouched when the receipt reported none", () => {
    // No tip-zeroing exists in any form: a charge must never alter the tip.
    const result = chargesFromExtraction({
      charges: [{ label: "Service Charge", amountCents: 1105 }],
      tipCents: null,
    });

    expect(result?.tip).toBeUndefined();
  });

  it("never zeroes the tip even when a gratuity-like charge is present", () => {
    const result = chargesFromExtraction({
      charges: [{ label: "Auto-Gratuity 18%", amountCents: 1105 }],
      tipCents: null,
    });

    expect(result?.tip).toBeUndefined();
  });
});

describe("writes against a legacy document", () => {
  // These mirror what is actually PERSISTED, not what the client holds in
  // memory. An earlier version of these tests built the client shape (charges
  // AND tip) and so stayed green while the server payload — charges alone —
  // was destroying the stored tip.
  const legacyWithTip = {
    taxTip: { ...LEGACY_BASE, taxCents: 700, tipCents: 1500 },
  };

  it("preserves a non-default tip when a charge is added", () => {
    const { charges, tip } = normalizeReceiptMoney(legacyWithTip, items(10000));
    // exactly the fsAddCharge payload
    const persisted = {
      ...legacyWithTip,
      charges: [...charges, { id: "new", label: "Corkage", amountCents: 1000 }],
      tip,
    };

    const after = normalizeReceiptMoney(persisted, items(10000));

    expect(after.tip.cents).toBe(1500);
    expect(after.tip.isPercent).toBe(false);
  });

  it("preserves a non-default tip when a charge is deleted", () => {
    const { charges, tip } = normalizeReceiptMoney(legacyWithTip, items(10000));
    const persisted = {
      ...legacyWithTip,
      charges: charges.filter((c) => c.label !== "Tax"),
      tip,
    };

    const after = normalizeReceiptMoney(persisted, items(10000));

    expect(after.tip.cents).toBe(1500);
  });

  it("keeps migrated charges when a new charge is appended", () => {
    const { charges, tip } = normalizeReceiptMoney(legacyWithTip, items(10000));
    const persisted = {
      ...legacyWithTip,
      charges: [...charges, { id: "new", label: "Corkage", amountCents: 1000 }],
      tip,
    };

    const after = normalizeReceiptMoney(persisted, items(10000));

    expect(after.charges.map((c) => c.label)).toEqual(["Tax", "Corkage"]);
    expect(after.charges.reduce((s, c) => s + c.amountCents, 0)).toBe(1700);
  });

  it("applies a tip change instead of discarding it", () => {
    const { charges, tip } = normalizeReceiptMoney(legacyWithTip, items(10000));
    const persisted = {
      ...legacyWithTip,
      charges,
      tip: { ...tip, isPercent: false, cents: 5000 },
    };

    const after = normalizeReceiptMoney(persisted, items(10000));

    expect(after.tip.cents).toBe(5000);
    expect(after.tip.isPercent).toBe(false);
  });

  it("would lose the tip if a write persisted charges without tip", () => {
    // Guards the actual defect: every charge mutation must include tip in its
    // update payload. If one regresses to charges-only, this documents why.
    const { charges } = normalizeReceiptMoney(legacyWithTip, items(10000));
    const badPayload = { ...legacyWithTip, charges };

    const after = normalizeReceiptMoney(badPayload, items(10000));

    expect(after.tip.cents).toBe(0); // the tip is gone — do not ship a write like this
  });
});
