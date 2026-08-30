import { describe, it, expect } from "vitest";
import { timeAgo, generateShareText, generateCsv } from "../format";
import { calculateBreakdowns } from "../calculator";
import { ReceiptItem, Person, ReceiptCharge, Tip } from "@/types";

function mkItem(id: string, priceCents: number, assignedTo: string[]): ReceiptItem {
  return { id, name: id, quantity: 1, priceCents, assignedTo };
}
function mkPerson(id: string): Person {
  return { id, name: id, color: "#000" };
}
const NO_TIP: Tip = { cents: 0, isPercent: false, percent: 0 };

function fixture(charges: ReceiptCharge[], tip: Tip = NO_TIP) {
  const items = [mkItem("a", 6000, ["p1"]), mkItem("b", 4000, ["p2"])];
  const people = [mkPerson("p1"), mkPerson("p2")];
  return { items, breakdowns: calculateBreakdowns(items, people, charges, tip) };
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


describe("generateShareText", () => {
  // Byte-identity baseline. Captured from the implementation, not hand-written,
  // so it is a regression pin rather than a restatement of the code. Note there
  // is no permanent "Tax" line any more: a charge appears only if the receipt
  // carried one.
  it("produces exactly this text when there are no charges", () => {
    const { items, breakdowns } = fixture([]);

    expect(generateShareText(items, [], NO_TIP, breakdowns, "USD")).toBe(
      [
        "Shplit",
        "\u2500".repeat(30),
        "Subtotal: $100.00",
        "Tip: $0.00",
        "Total: $100.00",
        "",
        "Per Person:",
        "\u2500".repeat(30),
        "p1: $60.00",
        "  \u2022 a: $60.00",
        "",
        "p2: $40.00",
        "  \u2022 b: $40.00",
        "",
      ].join("\n")
    );
  });

  it("lists each charge by its parsed label", () => {
    const charges = [
      { id: "c1", label: "Tax", amountCents: 537 },
      { id: "c2", label: "Service Charge 18%", amountCents: 1800 },
    ];
    const { items, breakdowns } = fixture(charges);

    const text = generateShareText(items, charges, NO_TIP, breakdowns, "USD");

    expect(text).toContain("Tax: $5.37");
    expect(text).toContain("Service Charge 18%: $18.00");
  });

  it("includes every charge in the grand total", () => {
    const charges = [{ id: "c1", label: "Tax", amountCents: 500 }];
    const { items, breakdowns } = fixture(charges);

    expect(generateShareText(items, charges, NO_TIP, breakdowns, "USD")).toContain(
      "Total: $105.00"
    );
  });

  it("shows each person their share of each charge", () => {
    const charges = [{ id: "c1", label: "Bag Fee", amountCents: 100 }];
    const { items, breakdowns } = fixture(charges);

    const text = generateShareText(items, charges, NO_TIP, breakdowns, "USD");

    expect(text).toContain("\u2022 Bag Fee: $0.60");
    expect(text).toContain("\u2022 Bag Fee: $0.40");
  });
});

describe("generateCsv", () => {
  it("produces exactly this CSV when there are no charges", () => {
    const { items, breakdowns } = fixture([]);

    expect(generateCsv(items, [], NO_TIP, breakdowns, "USD")).toBe(
      [
        "Item,Qty,Price,Total,p1,p2",
        '"a",1,60.00,60.00,60.00,',
        '"b",1,40.00,40.00,,40.00',
        "Subtotal,,,100.00,60.00,40.00",
        "Tip,,,0.00,0.00,0.00",
        "Total,,,100.00,60.00,40.00",
      ].join("\n")
    );
  });

  it("emits one row per charge with per-person shares", () => {
    const charges = [{ id: "c1", label: "Tax", amountCents: 1000 }];
    const { items, breakdowns } = fixture(charges);

    expect(generateCsv(items, charges, NO_TIP, breakdowns, "USD")).toContain(
      '"Tax",,,10.00,6.00,4.00'
    );
  });

  it("includes charges in the CSV total row", () => {
    const charges = [{ id: "c1", label: "Tax", amountCents: 1000 }];
    const { items, breakdowns } = fixture(charges);

    expect(generateCsv(items, charges, NO_TIP, breakdowns, "USD")).toContain(
      "Total,,,110.00,66.00,44.00"
    );
  });
});
