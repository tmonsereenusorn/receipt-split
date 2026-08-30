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
});
