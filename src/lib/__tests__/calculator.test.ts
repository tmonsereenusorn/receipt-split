import { describe, it, expect } from "vitest";
import {
  calculateBreakdowns,
  getSubtotalCents,
  getEffectiveTaxCents,
  getEffectiveTipCents,
  getEffectiveServiceCents,
} from "../calculator";
import { ReceiptItem, Person, TaxTip } from "@/types";

function makeItem(
  id: string,
  priceCents: number,
  assignedTo: string[],
  quantity = 1
): ReceiptItem {
  return { id, name: id, quantity, priceCents, assignedTo };
}

function makePerson(id: string, name?: string): Person {
  return { id, name: name || id, color: "#000" };
}

const defaultTaxTip: TaxTip = {
  taxCents: 0,
  taxIsPercent: false,
  taxPercent: 0,
  tipCents: 0,
  tipIsPercent: false,
  tipPercent: 0,
  serviceCents: 0,
  serviceIsPercent: false,
  servicePercent: 0,
};

describe("getSubtotalCents", () => {
  it("sums qty * price for all items", () => {
    const items = [
      makeItem("a", 1000, [], 2),
      makeItem("b", 500, [], 1),
    ];
    expect(getSubtotalCents(items)).toBe(2500);
  });

  it("returns 0 for empty items", () => {
    expect(getSubtotalCents([])).toBe(0);
  });
});

describe("getEffectiveTaxCents", () => {
  it("returns taxCents when not percent", () => {
    expect(
      getEffectiveTaxCents({ ...defaultTaxTip, taxCents: 800 }, 10000)
    ).toBe(800);
  });

  it("calculates percent tax from subtotal", () => {
    const tax = getEffectiveTaxCents(
      { ...defaultTaxTip, taxIsPercent: true, taxPercent: 8 },
      10000
    );
    expect(tax).toBe(800);
  });

  it("handles 0% tax", () => {
    const tax = getEffectiveTaxCents(
      { ...defaultTaxTip, taxIsPercent: true, taxPercent: 0 },
      10000
    );
    expect(tax).toBe(0);
  });
});

describe("getEffectiveTipCents", () => {
  it("returns tipCents when not percent", () => {
    expect(
      getEffectiveTipCents({ ...defaultTaxTip, tipCents: 500 }, 2000)
    ).toBe(500);
  });

  it("calculates percent tip from subtotal", () => {
    const tip = getEffectiveTipCents(
      { ...defaultTaxTip, tipIsPercent: true, tipPercent: 20 },
      10000
    );
    expect(tip).toBe(2000);
  });

  it("handles 0% tip", () => {
    const tip = getEffectiveTipCents(
      { ...defaultTaxTip, tipIsPercent: true, tipPercent: 0 },
      10000
    );
    expect(tip).toBe(0);
  });
});

describe("calculateBreakdowns", () => {
  it("splits items evenly between assigned people", () => {
    const items = [makeItem("burger", 1000, ["alice", "bob"])];
    const people = [makePerson("alice"), makePerson("bob")];

    const breakdowns = calculateBreakdowns(items, people, defaultTaxTip);

    expect(breakdowns[0].subtotalCents).toBe(500);
    expect(breakdowns[1].subtotalCents).toBe(500);
  });

  it("gives remainder to last person on odd splits", () => {
    const items = [makeItem("pizza", 1001, ["a", "b", "c"])];
    const people = [makePerson("a"), makePerson("b"), makePerson("c")];

    const breakdowns = calculateBreakdowns(items, people, defaultTaxTip);

    expect(breakdowns[0].subtotalCents).toBe(333);
    expect(breakdowns[1].subtotalCents).toBe(333);
    expect(breakdowns[2].subtotalCents).toBe(335); // 333 + 2 remainder
    // Total should be exact
    const total =
      breakdowns[0].subtotalCents +
      breakdowns[1].subtotalCents +
      breakdowns[2].subtotalCents;
    expect(total).toBe(1001);
  });

  it("distributes tax proportionally", () => {
    const items = [
      makeItem("expensive", 8000, ["alice"]),
      makeItem("cheap", 2000, ["bob"]),
    ];
    const people = [makePerson("alice"), makePerson("bob")];
    const taxTip = { ...defaultTaxTip, taxCents: 1000 };

    const breakdowns = calculateBreakdowns(items, people, taxTip);

    expect(breakdowns[0].taxShareCents).toBe(800);
    expect(breakdowns[1].taxShareCents).toBe(200);
  });

  it("distributes tip proportionally", () => {
    const items = [
      makeItem("a", 6000, ["p1"]),
      makeItem("b", 4000, ["p2"]),
    ];
    const people = [makePerson("p1"), makePerson("p2")];
    const taxTip: TaxTip = {
      ...defaultTaxTip,
      tipIsPercent: true,
      tipPercent: 20,
    };

    const breakdowns = calculateBreakdowns(items, people, taxTip);

    // 20% of $100 = $20 total tip
    // p1 has 60% subtotal -> $12 tip
    // p2 has 40% subtotal -> $8 tip
    expect(breakdowns[0].tipShareCents).toBe(1200);
    expect(breakdowns[1].tipShareCents).toBe(800);
  });

  it("per-person totals sum to grand total", () => {
    const items = [
      makeItem("a", 1599, ["p1", "p2"]),
      makeItem("b", 899, ["p2", "p3"]),
      makeItem("c", 2150, ["p1"]),
    ];
    const people = [
      makePerson("p1"),
      makePerson("p2"),
      makePerson("p3"),
    ];
    const taxTip: TaxTip = {
      taxCents: 347,
      taxIsPercent: false,
      taxPercent: 0,
      tipCents: 500,
      tipIsPercent: false,
      tipPercent: 0,
      serviceCents: 0,
      serviceIsPercent: false,
      servicePercent: 0,
    };

    const breakdowns = calculateBreakdowns(items, people, taxTip);

    // Tax/tip is based on assigned subtotal, not full receipt subtotal
    const assignedSubtotal = breakdowns.reduce((s, b) => s + b.subtotalCents, 0);
    const grandTotal = assignedSubtotal + getEffectiveTaxCents(taxTip, assignedSubtotal) + getEffectiveTipCents(taxTip, assignedSubtotal);
    const personTotal = breakdowns.reduce((s, b) => s + b.totalCents, 0);

    expect(personTotal).toBe(grandTotal);
  });

  it("handles items with quantity > 1", () => {
    const items = [makeItem("beer", 600, ["alice"], 3)];
    const people = [makePerson("alice")];

    const breakdowns = calculateBreakdowns(items, people, defaultTaxTip);

    // 3 * $6.00 = $18.00
    expect(breakdowns[0].subtotalCents).toBe(1800);
    expect(breakdowns[0].totalCents).toBe(1800);
  });

  it("computes tax/tip from assigned subtotal, not full receipt", () => {
    const items = [
      makeItem("a", 6000, ["p1"]),
      makeItem("b", 4000, ["p2"]),
      makeItem("unassigned", 5000, []),
    ];
    const people = [makePerson("p1"), makePerson("p2")];
    const taxTip: TaxTip = {
      ...defaultTaxTip,
      taxIsPercent: true,
      taxPercent: 10,
      tipIsPercent: true,
      tipPercent: 20,
    };

    const breakdowns = calculateBreakdowns(items, people, taxTip);

    // Tax/tip should be based on assigned subtotal ($100), not full receipt ($150)
    // p1: 10% of $60 = $6 tax, 20% of $60 = $12 tip
    // p2: 10% of $40 = $4 tax, 20% of $40 = $8 tip
    expect(breakdowns[0].taxShareCents).toBe(600);
    expect(breakdowns[0].tipShareCents).toBe(1200);
    expect(breakdowns[1].taxShareCents).toBe(400);
    expect(breakdowns[1].tipShareCents).toBe(800);
  });

  it("handles no assignments", () => {
    const items = [makeItem("orphan", 1000, [])];
    const people = [makePerson("alice")];

    const breakdowns = calculateBreakdowns(items, people, defaultTaxTip);

    expect(breakdowns[0].subtotalCents).toBe(0);
    expect(breakdowns[0].items).toHaveLength(0);
  });
});

describe("getEffectiveServiceCents", () => {
  it("returns the fixed amount when not in percent mode", () => {
    const taxTip = { ...defaultTaxTip, serviceCents: 2567 };
    expect(getEffectiveServiceCents(taxTip, 14260)).toBe(2567);
  });

  it("computes from the subtotal when in percent mode", () => {
    const taxTip = { ...defaultTaxTip, serviceIsPercent: true, servicePercent: 18 };
    // 14260 * 0.18 = 2566.8, rounds to 2567
    expect(getEffectiveServiceCents(taxTip, 14260)).toBe(2567);
  });

  it("treats a legacy taxTip with no service keys as zero", () => {
    // Receipts created before this feature have a taxTip map without the three
    // service keys. Reading them must not yield NaN.
    const legacy = {
      taxCents: 0,
      taxIsPercent: false,
      taxPercent: 0,
      tipCents: 0,
      tipIsPercent: false,
      tipPercent: 0,
    } as unknown as TaxTip;
    expect(getEffectiveServiceCents(legacy, 14260)).toBe(0);
  });
});

describe("calculateBreakdowns with a service charge", () => {
  it("distributes the service charge proportionally to subtotals", () => {
    const items = [makeItem("a", 6000, ["p1"]), makeItem("b", 4000, ["p2"])];
    const people = [makePerson("p1"), makePerson("p2")];
    const taxTip = { ...defaultTaxTip, serviceCents: 1000 };

    const [b1, b2] = calculateBreakdowns(items, people, taxTip);

    expect(b1.serviceShareCents).toBe(600);
    expect(b2.serviceShareCents).toBe(400);
  });

  it("includes the service share in each person's total", () => {
    const items = [makeItem("a", 6000, ["p1"]), makeItem("b", 4000, ["p2"])];
    const people = [makePerson("p1"), makePerson("p2")];
    const taxTip = { ...defaultTaxTip, serviceCents: 1000 };

    const [b1, b2] = calculateBreakdowns(items, people, taxTip);

    expect(b1.totalCents).toBe(6600);
    expect(b2.totalCents).toBe(4400);
  });

  it("gives the remainder to the last person so shares sum exactly", () => {
    const items = [
      makeItem("a", 3333, ["p1"]),
      makeItem("b", 3333, ["p2"]),
      makeItem("c", 3334, ["p3"]),
    ];
    const people = [makePerson("p1"), makePerson("p2"), makePerson("p3")];
    const taxTip = { ...defaultTaxTip, serviceCents: 1000 };

    const breakdowns = calculateBreakdowns(items, people, taxTip);
    const summed = breakdowns.reduce((s, b) => s + b.serviceShareCents, 0);

    expect(summed).toBe(1000);
  });

  it("computes a percent service charge from the assigned subtotal", () => {
    const items = [makeItem("a", 10000, ["p1"])];
    const people = [makePerson("p1")];
    const taxTip = { ...defaultTaxTip, serviceIsPercent: true, servicePercent: 18 };

    const [b] = calculateBreakdowns(items, people, taxTip);

    expect(b.serviceShareCents).toBe(1800);
    expect(b.totalCents).toBe(11800);
  });

  it("changes no total when there is no service charge", () => {
    const items = [makeItem("a", 6000, ["p1"])];
    const people = [makePerson("p1")];
    const taxTip = { ...defaultTaxTip, taxCents: 500, tipCents: 1000 };

    const [b] = calculateBreakdowns(items, people, taxTip);

    expect(b.serviceShareCents).toBe(0);
    expect(b.totalCents).toBe(7500);
  });
});
