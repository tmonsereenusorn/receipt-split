import { describe, it, expect, beforeEach } from "vitest";
import { parseReceiptText, resetIdCounter } from "../parser";

beforeEach(() => {
  resetIdCounter();
});

describe("parseReceiptText", () => {
  it("parses name + price lines", () => {
    const text = `
      Burger 12.99
      Fries 4.50
      Soda 2.99
    `;
    const items = parseReceiptText(text);
    expect(items).toHaveLength(3);
    expect(items[0]).toMatchObject({
      name: "Burger",
      quantity: 1,
      priceCents: 1299,
    });
    expect(items[1]).toMatchObject({
      name: "Fries",
      quantity: 1,
      priceCents: 450,
    });
    expect(items[2]).toMatchObject({
      name: "Soda",
      quantity: 1,
      priceCents: 299,
    });
  });

  it("parses name + $ price lines", () => {
    const text = `Chicken Wings $8.50`;
    const items = parseReceiptText(text);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      name: "Chicken Wings",
      priceCents: 850,
    });
  });

  it("parses qty x name + price lines", () => {
    const text = `2 x Tacos 6.00`;
    const items = parseReceiptText(text);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      name: "Tacos",
      quantity: 2,
      priceCents: 600,
    });
  });

  it("parses qty name price lines", () => {
    const text = `3 Beer 21.00`;
    const items = parseReceiptText(text);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      name: "Beer",
      quantity: 3,
      priceCents: 2100,
    });
  });

  it("skips subtotal, tax, tip, total lines", () => {
    const text = `
      Burger 12.99
      Subtotal 12.99
      Tax 1.04
      Tip 2.60
      Total 16.63
    `;
    const items = parseReceiptText(text);
    expect(items).toHaveLength(1);
    expect(items[0].name).toBe("Burger");
  });

  it("skips payment method lines", () => {
    const text = `
      Pasta 15.00
      VISA ending in 1234
      Thank you!
    `;
    const items = parseReceiptText(text);
    expect(items).toHaveLength(1);
  });

  it("skips date and time lines", () => {
    const text = `
      12/25/2024
      3:45 PM
      Coffee 5.00
    `;
    const items = parseReceiptText(text);
    expect(items).toHaveLength(1);
    expect(items[0].name).toBe("Coffee");
  });

  it("handles empty text", () => {
    expect(parseReceiptText("")).toHaveLength(0);
    expect(parseReceiptText("   \n  \n  ")).toHaveLength(0);
  });

  it("assigns empty assignedTo arrays", () => {
    const items = parseReceiptText("Steak 25.00");
    expect(items[0].assignedTo).toEqual([]);
  });

  it("generates unique IDs", () => {
    const items = parseReceiptText("Apple 1.00\nBurger 2.00\nCoffee 3.00");
    const ids = items.map((i) => i.id);
    expect(new Set(ids).size).toBe(3);
  });

  it("handles multi-word item names", () => {
    const text = `Grilled Chicken Sandwich 14.50`;
    const items = parseReceiptText(text);
    expect(items).toHaveLength(1);
    expect(items[0].name).toBe("Grilled Chicken Sandwich");
  });

  it("parses multi-line name/price pairs (Google Vision format)", () => {
    const text = `CHICKEN KARAAGE\n9.50\nMISO SALMON ROLL\n14.95`;
    const items = parseReceiptText(text);
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({
      name: "CHICKEN KARAAGE",
      quantity: 1,
      priceCents: 950,
    });
    expect(items[1]).toMatchObject({
      name: "MISO SALMON ROLL",
      quantity: 1,
      priceCents: 1495,
    });
  });

  it("skips multi-line noise (subtotal on separate line)", () => {
    const text = `CRAZY ROLL\n15.75\nSUBTOTAL:\n322.05`;
    const items = parseReceiptText(text);
    expect(items).toHaveLength(1);
    expect(items[0].name).toBe("CRAZY ROLL");
  });

  it("handles real Google Vision receipt output", () => {
    const text = `Wasabi Bistro
524 Castro St. San Francisco,, CA 94114
415-701-0082
Tab
AB 10P 19:23
#1040
CHICKEN KARAAGE
9.50
MISO SALMON ROLL
14.95
CRAZY ROLL
15.75
BOSTON ROLL
8.60
SUBTOTAL:
322.05
20% SERVICE CHARGE:
64.41
Tax (3.625%):
33.33
SALES TOTAL:
355.38
Credit card
419.79
Cash Discount:
-12.50
02/27/2026 19:53 Server:Ricky
!!! THANK YOU !!!`;
    const items = parseReceiptText(text);
    expect(items.length).toBeGreaterThanOrEqual(5);
    expect(items[0]).toMatchObject({
      name: "CHICKEN KARAAGE",
      priceCents: 950,
    });
  });
});
