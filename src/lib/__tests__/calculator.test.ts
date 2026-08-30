import { describe, it, expect } from "vitest";
import {
  calculateBreakdowns,
  getSubtotalCents,
  getChargesTotalCents,
  getEffectiveTipCents,
} from "../calculator";
import { ReceiptItem, Person, ReceiptCharge, Tip } from "@/types";

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

function charge(id: string, label: string, amountCents: number): ReceiptCharge {
  return { id, label, amountCents };
}

const noTip: Tip = { cents: 0, isPercent: false, percent: 0 };

describe("getSubtotalCents", () => {
  it("sums qty * price for all items", () => {
    const items = [makeItem("a", 1000, [], 2), makeItem("b", 500, [], 1)];
    expect(getSubtotalCents(items)).toBe(2500);
  });

  it("returns 0 for empty items", () => {
    expect(getSubtotalCents([])).toBe(0);
  });
});

describe("getChargesTotalCents", () => {
  it("sums every charge", () => {
    expect(
      getChargesTotalCents([
        charge("c1", "Tax", 537),
        charge("c2", "Service Charge", 1105),
      ])
    ).toBe(1642);
  });

  it("returns 0 for no charges", () => {
    expect(getChargesTotalCents([])).toBe(0);
  });
});

describe("getEffectiveTipCents", () => {
  it("returns cents when not percent", () => {
    expect(getEffectiveTipCents({ ...noTip, cents: 500 }, 2000)).toBe(500);
  });

  it("calculates percent tip from subtotal", () => {
    expect(
      getEffectiveTipCents({ cents: 0, isPercent: true, percent: 20 }, 10000)
    ).toBe(2000);
  });

  it("handles 0% tip", () => {
    expect(
      getEffectiveTipCents({ cents: 0, isPercent: true, percent: 0 }, 10000)
    ).toBe(0);
  });
});

describe("calculateBreakdowns", () => {
  it("splits items evenly between assigned people", () => {
    const items = [makeItem("burger", 1000, ["alice", "bob"])];
    const people = [makePerson("alice"), makePerson("bob")];

    const breakdowns = calculateBreakdowns(items, people, [], noTip);

    expect(breakdowns[0].subtotalCents).toBe(500);
    expect(breakdowns[1].subtotalCents).toBe(500);
  });

  it("gives remainder to last person on odd splits", () => {
    const items = [makeItem("pizza", 1001, ["a", "b", "c"])];
    const people = [makePerson("a"), makePerson("b"), makePerson("c")];

    const breakdowns = calculateBreakdowns(items, people, [], noTip);

    expect(breakdowns[0].subtotalCents).toBe(333);
    expect(breakdowns[1].subtotalCents).toBe(333);
    expect(breakdowns[2].subtotalCents).toBe(335);
    const total = breakdowns.reduce((s, b) => s + b.subtotalCents, 0);
    expect(total).toBe(1001);
  });

  it("distributes a charge proportionally to subtotals", () => {
    const items = [
      makeItem("expensive", 8000, ["alice"]),
      makeItem("cheap", 2000, ["bob"]),
    ];
    const people = [makePerson("alice"), makePerson("bob")];
    const charges = [charge("c1", "Tax", 1000)];

    const breakdowns = calculateBreakdowns(items, people, charges, noTip);

    expect(breakdowns[0].chargeShares[0].shareCents).toBe(800);
    expect(breakdowns[1].chargeShares[0].shareCents).toBe(200);
  });

  it("carries the charge id and label into every share", () => {
    const items = [makeItem("a", 6000, ["p1"]), makeItem("b", 4000, ["p2"])];
    const people = [makePerson("p1"), makePerson("p2")];
    const charges = [
      charge("c1", "Tax", 500),
      charge("c2", "Service Charge", 1000),
    ];

    const [b1] = calculateBreakdowns(items, people, charges, noTip);

    expect(b1.chargeShares).toHaveLength(2);
    expect(b1.chargeShares[0]).toMatchObject({ chargeId: "c1", label: "Tax" });
    expect(b1.chargeShares[1]).toMatchObject({
      chargeId: "c2",
      label: "Service Charge",
    });
  });

  it("makes each charge's shares sum exactly to that charge", () => {
    const items = [
      makeItem("a", 3333, ["p1"]),
      makeItem("b", 3333, ["p2"]),
      makeItem("c", 3334, ["p3"]),
    ];
    const people = [makePerson("p1"), makePerson("p2"), makePerson("p3")];
    const charges = [charge("c1", "Tax", 1000), charge("c2", "Bag Fee", 7)];

    const breakdowns = calculateBreakdowns(items, people, charges, noTip);

    for (const [index, c] of charges.entries()) {
      const summed = breakdowns.reduce(
        (s, b) => s + b.chargeShares[index].shareCents,
        0
      );
      expect(summed).toBe(c.amountCents);
    }
  });

  it("includes every charge share in the person total", () => {
    const items = [makeItem("a", 6000, ["p1"]), makeItem("b", 4000, ["p2"])];
    const people = [makePerson("p1"), makePerson("p2")];
    const charges = [charge("c1", "Tax", 500), charge("c2", "Bag Fee", 100)];

    const [b1, b2] = calculateBreakdowns(items, people, charges, noTip);

    expect(b1.totalCents).toBe(6000 + 300 + 60);
    expect(b2.totalCents).toBe(4000 + 200 + 40);
  });

  it("distributes tip proportionally", () => {
    const items = [makeItem("a", 6000, ["p1"]), makeItem("b", 4000, ["p2"])];
    const people = [makePerson("p1"), makePerson("p2")];
    const tip: Tip = { cents: 0, isPercent: true, percent: 20 };

    const breakdowns = calculateBreakdowns(items, people, [], tip);

    expect(breakdowns[0].tipShareCents).toBe(1200);
    expect(breakdowns[1].tipShareCents).toBe(800);
  });

  it("computes a percent tip on the subtotal only, never on charges", () => {
    // A tip compounding on a service charge would inflate the bill.
    const items = [makeItem("a", 10000, ["p1"])];
    const people = [makePerson("p1")];
    const charges = [charge("c1", "Service Charge", 5000)];
    const tip: Tip = { cents: 0, isPercent: true, percent: 20 };

    const [b] = calculateBreakdowns(items, people, charges, tip);

    expect(b.tipShareCents).toBe(2000); // 20% of 10000, not of 15000
    expect(b.totalCents).toBe(10000 + 5000 + 2000);
  });

  it("changes nothing when there are no charges", () => {
    const items = [makeItem("a", 6000, ["p1"])];
    const people = [makePerson("p1")];
    const tip: Tip = { cents: 1000, isPercent: false, percent: 0 };

    const [b] = calculateBreakdowns(items, people, [], tip);

    expect(b.chargeShares).toEqual([]);
    expect(b.totalCents).toBe(7000);
  });

  it("per-person totals sum to the grand total", () => {
    const items = [
      makeItem("a", 1599, ["p1", "p2"]),
      makeItem("b", 899, ["p2", "p3"]),
      makeItem("c", 2150, ["p1"]),
    ];
    const people = [makePerson("p1"), makePerson("p2"), makePerson("p3")];
    const charges = [charge("c1", "Tax", 347), charge("c2", "Service", 211)];
    const tip: Tip = { cents: 500, isPercent: false, percent: 0 };

    const breakdowns = calculateBreakdowns(items, people, charges, tip);

    const assignedSubtotal = breakdowns.reduce((s, b) => s + b.subtotalCents, 0);
    const grandTotal =
      assignedSubtotal +
      getChargesTotalCents(charges) +
      getEffectiveTipCents(tip, assignedSubtotal);
    const personTotal = breakdowns.reduce((s, b) => s + b.totalCents, 0);

    expect(personTotal).toBe(grandTotal);
  });

  it("handles items with quantity > 1", () => {
    const items = [makeItem("beer", 600, ["alice"], 3)];
    const people = [makePerson("alice")];

    const breakdowns = calculateBreakdowns(items, people, [], noTip);

    expect(breakdowns[0].subtotalCents).toBe(1800);
    expect(breakdowns[0].totalCents).toBe(1800);
  });

  it("computes the tip from the assigned subtotal, not the full receipt", () => {
    const items = [
      makeItem("a", 6000, ["p1"]),
      makeItem("b", 4000, ["p2"]),
      makeItem("unassigned", 5000, []),
    ];
    const people = [makePerson("p1"), makePerson("p2")];
    const tip: Tip = { cents: 0, isPercent: true, percent: 10 };

    const breakdowns = calculateBreakdowns(items, people, [], tip);

    // 10% of the 10000 assigned, not of the 15000 on the receipt
    const totalTip = breakdowns.reduce((s, b) => s + b.tipShareCents, 0);
    expect(totalTip).toBe(1000);
  });

  it("returns zero shares when nothing is assigned", () => {
    const items = [makeItem("a", 5000, [])];
    const people = [makePerson("p1")];
    const charges = [charge("c1", "Tax", 400)];
    const tip: Tip = { cents: 0, isPercent: true, percent: 20 };

    const [b] = calculateBreakdowns(items, people, charges, tip);

    expect(b.subtotalCents).toBe(0);
    expect(b.chargeShares[0].shareCents).toBe(0);
    expect(b.tipShareCents).toBe(0);
    expect(b.totalCents).toBe(0);
  });
});
