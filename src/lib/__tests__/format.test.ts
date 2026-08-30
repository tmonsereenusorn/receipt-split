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
  const LINK = "https://shplit.vercel.app/receipt/aB3xY";

  it("produces exactly this text: total, one line per person, then the link", () => {
    // Byte-identity, because this is what gets pasted into a group chat and a
    // stray line is immediately visible to everyone in it.
    const { items, breakdowns } = fixture([]);

    expect(
      generateShareText(items, [], NO_TIP, breakdowns, "USD", LINK, "The Garden Bistro")
    ).toBe(
      [
        "Shplit · The Garden Bistro",
        "Total: $100.00",
        "",
        "p1: $60.00",
        "p2: $40.00",
        "",
        LINK,
      ].join("\n")
    );
  });

  it("omits the restaurant when the receipt has no name", () => {
    const { items, breakdowns } = fixture([]);

    const text = generateShareText(items, [], NO_TIP, breakdowns, "USD", LINK, null);

    expect(text.split("\n")[0]).toBe("Shplit");
  });

  it("includes charges and tip in the total but never itemises them", () => {
    // The whole point of the format: the totals are right, the breakdown is a
    // tap away rather than pasted into the chat.
    const charges = [{ id: "c1", label: "Tax", amountCents: 800 }];
    const tip: Tip = { cents: 0, isPercent: true, percent: 20 };
    const { items, breakdowns } = fixture(charges, tip);

    const text = generateShareText(items, charges, tip, breakdowns, "USD", LINK, null);

    expect(text).toContain("Total: $128.00");
    expect(text).not.toContain("Tax");
    expect(text).not.toContain("Tip");
  });

  it("never lists an item", () => {
    const charges = [{ id: "c1", label: "Tax", amountCents: 800 }];
    const { items, breakdowns } = fixture(charges);

    const text = generateShareText(items, charges, NO_TIP, breakdowns, "USD", LINK, null);

    // fixture items are named "a" and "b"
    expect(text).not.toMatch(/^\s*[•·]/m);
    expect(text.split("\n").filter((l) => l.startsWith("a:")).length).toBe(0);
  });

  it("flags an unassigned remainder so the numbers reconcile", () => {
    // Charges and tip are distributed across assigned items only, so with
    // anything unassigned the per-person lines sum to less than the total. Left
    // silent, that reads as an arithmetic error.
    const items = [
      mkItem("a", 6000, ["p1"]),
      mkItem("b", 4000, ["p2"]),
      mkItem("c", 3000, []),
    ];
    const people = [mkPerson("p1"), mkPerson("p2")];
    const breakdowns = calculateBreakdowns(items, people, [], NO_TIP);

    const text = generateShareText(items, [], NO_TIP, breakdowns, "USD", LINK, null);

    expect(text).toContain("Total: $130.00 · $30.00 unassigned");
  });

  it("says nothing about unassigned when everything is assigned", () => {
    const { items, breakdowns } = fixture([]);

    expect(
      generateShareText(items, [], NO_TIP, breakdowns, "USD", LINK, null)
    ).not.toContain("unassigned");
  });

  it("ends with the link", () => {
    const { items, breakdowns } = fixture([]);

    const text = generateShareText(items, [], NO_TIP, breakdowns, "USD", LINK, null);

    expect(text.trimEnd().endsWith(LINK)).toBe(true);
  });

  it("omits a person who owes nothing", () => {
    // Someone added to the receipt but assigned no items is noise in a summary.
    const items = [mkItem("a", 6000, ["p1"])];
    const people = [mkPerson("p1"), mkPerson("p2")];
    const breakdowns = calculateBreakdowns(items, people, [], NO_TIP);

    const text = generateShareText(items, [], NO_TIP, breakdowns, "USD", LINK, null);

    expect(text).toContain("p1: $60.00");
    expect(text).not.toContain("p2:");
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

describe("negative charges in exports", () => {
  const charges = [
    { id: "c1", label: "Tax", amountCents: 800 },
    { id: "c2", label: "Promo", amountCents: -1000 },
  ];

  it("counts a discount in the share text total, though it no longer itemises", () => {
    // The compact format shows no charge lines, but a negative charge must
    // still reduce the total — otherwise the summary overstates the bill.
    const { items, breakdowns } = fixture(charges);

    const text = generateShareText(
      items,
      charges,
      NO_TIP,
      breakdowns,
      "USD",
      "https://example.test/r/1",
      null
    );

    expect(text).toContain("Total: $98.00");
    expect(text).not.toContain("Promo");
  });

  it("renders a discount row in the CSV with negative shares", () => {
    const { items, breakdowns } = fixture(charges);

    const csv = generateCsv(items, charges, NO_TIP, breakdowns, "USD");

    expect(csv).toContain('"Promo",,,-10.00,-6.00,-4.00');
    expect(csv).toContain("Total,,,98.00");
  });
});
