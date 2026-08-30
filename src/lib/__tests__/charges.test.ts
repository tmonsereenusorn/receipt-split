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

    expect(result?.tip).toEqual({ cents: 1250, isPercent: false, percent: 0 });
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
