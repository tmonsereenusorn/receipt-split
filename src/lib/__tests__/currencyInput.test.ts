import { describe, it, expect } from "vitest";
import { parseCurrencyInput } from "../currencyInput";

describe("parseCurrencyInput", () => {
  it("converts dollars to cents", () => {
    expect(parseCurrencyInput("12.99", false).cents).toBe(1299);
  });

  it("rounds a third decimal place", () => {
    expect(parseCurrencyInput("12.994", false).cents).toBe(1299);
  });

  it("reverts on non-numeric input", () => {
    expect(parseCurrencyInput("abc", false).cents).toBeNull();
  });

  it("reverts on an empty field", () => {
    expect(parseCurrencyInput("", false).cents).toBeNull();
  });

  it("rejects a negative when negatives are not allowed", () => {
    // A negative tip is meaningless, so the tip field keeps this behavior.
    expect(parseCurrencyInput("-5.00", false).cents).toBeNull();
  });

  it("accepts a negative when negatives are allowed", () => {
    // A charge may be a discount. Without this the promo line parsed from a
    // receipt could not be entered or corrected by hand at all.
    expect(parseCurrencyInput("-4.31", true).cents).toBe(-431);
  });

  it("accepts a positive when negatives are allowed", () => {
    expect(parseCurrencyInput("4.31", true).cents).toBe(431);
  });

  it("accepts zero", () => {
    expect(parseCurrencyInput("0", true).cents).toBe(0);
  });

  it("rejects Infinity", () => {
    // parseFloat("Infinity") is not NaN, so this reached formatMoney as $∞.
    expect(parseCurrencyInput("Infinity", true).cents).toBeNull();
    expect(parseCurrencyInput("-Infinity", true).cents).toBeNull();
  });

  it("rejects exponent notation", () => {
    expect(parseCurrencyInput("1e10", true).cents).toBeNull();
  });

  it("rejects an amount beyond the magnitude bound", () => {
    // Rejected here rather than at the mutation, which throws into a
    // fire-and-forget call and would leave a wrong total on screen.
    expect(parseCurrencyInput("99999999", true).cents).toBeNull();
  });

  it("rejects trailing garbage rather than committing the numeric prefix", () => {
    expect(parseCurrencyInput("12abc", true).cents).toBeNull();
  });

  it("rejects a lone minus or decimal point", () => {
    expect(parseCurrencyInput("-", true).cents).toBeNull();
    expect(parseCurrencyInput(".", true).cents).toBeNull();
  });

  it("accepts a value at the magnitude bound", () => {
    expect(parseCurrencyInput("1000000", true).cents).toBe(100_000_000);
  });

  it("tolerates surrounding whitespace", () => {
    expect(parseCurrencyInput("  7 ", false).cents).toBe(700);
  });
});
