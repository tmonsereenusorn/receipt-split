import { describe, it, expect } from "vitest";
import {
  normalizeReceiptMoney,
  chargesFromExtraction,
  makeChargeId,
} from "../charges";
import { initialTip } from "@/types";

describe("normalizeReceiptMoney", () => {
  it("passes a new-shape document through unchanged", () => {
    const doc = {
      charges: [{ id: "c1", label: "Tax", amountCents: 537 }],
      tip: { cents: 0, isPercent: true, percent: 20 },
    };

    const result = normalizeReceiptMoney(doc);

    expect(result.charges).toEqual([{ id: "c1", label: "Tax", amountCents: 537 }]);
    expect(result.tip).toEqual({ cents: 0, isPercent: true, percent: 20 });
  });

  it("returns defaults for an absent map", () => {
    expect(normalizeReceiptMoney(undefined)).toEqual({
      charges: [],
      tip: initialTip,
    });
  });

  it("returns defaults for null", () => {
    expect(normalizeReceiptMoney(null)).toEqual({
      charges: [],
      tip: initialTip,
    });
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

    const result = normalizeReceiptMoney(doc);

    expect(result.charges.map((c) => c.id)).toEqual(["c1"]);
  });
});

describe("chargesFromExtraction", () => {
  it("returns null when the receipt reported no charges", () => {
    expect(chargesFromExtraction({ charges: [] })).toBeNull();
  });

  it("maps extracted charges to stored charges with ids", () => {
    const result = chargesFromExtraction({
      charges: [{ label: "Service Charge", amountCents: 1105 }],
    });

    expect(result).toEqual([
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
    });

    const ids = result?.map((c) => c.id) ?? [];
    expect(new Set(ids).size).toBe(2);
  });

  it("does not decide the tip", () => {
    // The tip is resolved once, in resolveInitialTip, which weighs the setup
    // answer against the bill. Two places deciding it is how the old
    // tip-zeroing bugs happened.
    const result = chargesFromExtraction({
      charges: [{ label: "Auto-Gratuity 18%", amountCents: 1105 }],
    });

    expect(result).toEqual([
      {
        id: makeChargeId("Auto-Gratuity 18%", 0),
        label: "Auto-Gratuity 18%",
        amountCents: 1105,
      },
    ]);
  });
});
