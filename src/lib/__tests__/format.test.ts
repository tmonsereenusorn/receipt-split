import { describe, it, expect } from "vitest";
import { timeAgo, generateShareText, generateCsv } from "../format";
import { calculateBreakdowns } from "../calculator";
import { ReceiptItem, Person, TaxTip, initialTaxTip } from "@/types";

function makeItem(id: string, priceCents: number, assignedTo: string[]): ReceiptItem {
  return { id, name: id, quantity: 1, priceCents, assignedTo };
}

function makePerson(id: string): Person {
  return { id, name: id, color: "#000" };
}

const noCharges: TaxTip = {
  ...initialTaxTip,
  taxCents: 0,
  taxIsPercent: false,
  tipCents: 0,
  tipIsPercent: false,
  tipPercent: 0,
};

function fixture(taxTip: TaxTip) {
  const items = [makeItem("a", 6000, ["p1"]), makeItem("b", 4000, ["p2"])];
  const people = [makePerson("p1"), makePerson("p2")];
  const breakdowns = calculateBreakdowns(items, people, taxTip);
  return { items, breakdowns };
}

describe("timeAgo", () => {
  it("returns 'just now' for timestamps less than 60s ago", () => {
    expect(timeAgo(Date.now() - 30_000)).toBe("just now");
  });

  it("returns minutes ago", () => {
    expect(timeAgo(Date.now() - 5 * 60_000)).toBe("5m ago");
  });

  it("returns hours ago", () => {
    expect(timeAgo(Date.now() - 3 * 3_600_000)).toBe("3h ago");
  });

  it("returns days ago", () => {
    expect(timeAgo(Date.now() - 2 * 86_400_000)).toBe("2d ago");
  });

  it("returns '1m ago' at exactly 60 seconds", () => {
    expect(timeAgo(Date.now() - 60_000)).toBe("1m ago");
  });
});

describe("generateShareText service charge", () => {
  it("includes a Service total when there is a service charge", () => {
    const taxTip = { ...noCharges, serviceCents: 1000 };
    const { items, breakdowns } = fixture(taxTip);

    const text = generateShareText(items, taxTip, breakdowns, "USD");

    expect(text).toContain("Service: $10.00");
  });

  it("includes each person's service share", () => {
    const taxTip = { ...noCharges, serviceCents: 1000 };
    const { items, breakdowns } = fixture(taxTip);

    const text = generateShareText(items, taxTip, breakdowns, "USD");

    expect(text).toContain("• Service: $6.00");
    expect(text).toContain("• Service: $4.00");
  });

  it("adds the service charge to the grand total", () => {
    const taxTip = { ...noCharges, serviceCents: 1000 };
    const { items, breakdowns } = fixture(taxTip);

    const text = generateShareText(items, taxTip, breakdowns, "USD");

    expect(text).toContain("Total: $110.00");
  });

  it("omits Service entirely when there is no service charge", () => {
    const { items, breakdowns } = fixture(noCharges);

    const text = generateShareText(items, noCharges, breakdowns, "USD");

    expect(text).not.toContain("Service");
  });
});

describe("generateCsv service charge", () => {
  it("includes a Service row with per-person shares", () => {
    const taxTip = { ...noCharges, serviceCents: 1000 };
    const { items, breakdowns } = fixture(taxTip);

    const csv = generateCsv(items, taxTip, breakdowns, "USD");

    expect(csv).toContain("Service,,,10.00,6.00,4.00");
  });

  it("adds the service charge to the Total row", () => {
    const taxTip = { ...noCharges, serviceCents: 1000 };
    const { items, breakdowns } = fixture(taxTip);

    const csv = generateCsv(items, taxTip, breakdowns, "USD");

    expect(csv).toContain("Total,,,110.00,66.00,44.00");
  });

  it("omits the Service row when there is no service charge", () => {
    const { items, breakdowns } = fixture(noCharges);

    const csv = generateCsv(items, noCharges, breakdowns, "USD");

    expect(csv).not.toContain("Service");
  });
});
