import { describe, it, expect } from "vitest";
import { subunitDecimals, formatMoney, formatMoneyRaw, currencySymbol, defaultCurrencyFromLocale } from "../currency";

describe("subunitDecimals", () => {
  it("returns 2 for USD", () => {
    expect(subunitDecimals("USD")).toBe(2);
  });

  it("returns 0 for JPY", () => {
    expect(subunitDecimals("JPY")).toBe(0);
  });

  it("returns 3 for BHD", () => {
    expect(subunitDecimals("BHD")).toBe(3);
  });

  it("returns 2 for EUR", () => {
    expect(subunitDecimals("EUR")).toBe(2);
  });
});

describe("formatMoney", () => {
  it("formats USD cents correctly", () => {
    expect(formatMoney(1299, "USD")).toBe("$12.99");
  });

  it("formats JPY with no decimals", () => {
    expect(formatMoney(1500, "JPY")).toBe("\u00a51,500");
  });

  it("formats EUR correctly", () => {
    expect(formatMoney(999, "EUR")).toBe("\u20ac9.99");
  });

  it("formats BHD with 3 decimals", () => {
    expect(formatMoney(1500, "BHD")).toBe("BHD\u00a01.500");
  });

  it("formats zero", () => {
    expect(formatMoney(0, "USD")).toBe("$0.00");
  });
});

describe("formatMoneyRaw", () => {
  it("formats USD without symbol", () => {
    expect(formatMoneyRaw(1299, "USD")).toBe("12.99");
  });

  it("formats JPY without symbol", () => {
    expect(formatMoneyRaw(1500, "JPY")).toBe("1500");
  });
});

describe("currencySymbol", () => {
  it("returns $ for USD", () => {
    expect(currencySymbol("USD")).toBe("$");
  });

  it("returns \u00a5 for JPY", () => {
    expect(currencySymbol("JPY")).toBe("\u00a5");
  });

  it("returns \u20ac for EUR", () => {
    expect(currencySymbol("EUR")).toBe("\u20ac");
  });
});

describe("defaultCurrencyFromLocale", () => {
  it("returns USD for en-US", () => {
    expect(defaultCurrencyFromLocale("en-US")).toBe("USD");
  });

  it("returns JPY for ja-JP", () => {
    expect(defaultCurrencyFromLocale("ja-JP")).toBe("JPY");
  });

  it("returns GBP for en-GB", () => {
    expect(defaultCurrencyFromLocale("en-GB")).toBe("GBP");
  });

  it("returns USD for unknown locale", () => {
    expect(defaultCurrencyFromLocale("xx")).toBe("USD");
  });

  it("returns EUR for de-DE", () => {
    expect(defaultCurrencyFromLocale("de-DE")).toBe("EUR");
  });
});
