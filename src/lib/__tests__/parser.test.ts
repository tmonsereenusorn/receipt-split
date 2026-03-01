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
});
