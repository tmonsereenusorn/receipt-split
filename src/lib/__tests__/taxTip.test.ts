import { describe, it, expect } from "vitest";
import { normalizeTaxTip, taxTipFromExtraction } from "../taxTip";
import { initialTaxTip, TaxTip } from "@/types";

describe("normalizeTaxTip", () => {
  it("fills in service defaults for a legacy doc missing them", () => {
    const legacy = {
      taxCents: 800,
      taxIsPercent: false,
      taxPercent: 7,
      tipCents: 1500,
      tipIsPercent: false,
      tipPercent: 20,
    } as unknown as Partial<TaxTip>;

    const result = normalizeTaxTip(legacy);

    expect(result.serviceCents).toBe(0);
    expect(result.serviceIsPercent).toBe(false);
    expect(result.servicePercent).toBe(18);
  });

  it("preserves the stored tax and tip values", () => {
    const legacy = {
      taxCents: 800,
      taxIsPercent: false,
      taxPercent: 7,
      tipCents: 1500,
      tipIsPercent: false,
      tipPercent: 20,
    } as unknown as Partial<TaxTip>;

    const result = normalizeTaxTip(legacy);

    expect(result.taxCents).toBe(800);
    expect(result.tipCents).toBe(1500);
  });

  it("preserves a stored service charge", () => {
    const result = normalizeTaxTip({ serviceCents: 2567 });

    expect(result.serviceCents).toBe(2567);
  });

  it("returns the defaults for undefined", () => {
    expect(normalizeTaxTip(undefined)).toEqual(initialTaxTip);
  });

  it("returns the defaults for null", () => {
    expect(normalizeTaxTip(null)).toEqual(initialTaxTip);
  });
});

describe("taxTipFromExtraction", () => {
  it("returns null when nothing was detected", () => {
    const result = taxTipFromExtraction({
      taxCents: null,
      tipCents: null,
      serviceChargeCents: null,
    });

    expect(result).toBeNull();
  });

  it("maps a detected tax to a fixed amount", () => {
    const result = taxTipFromExtraction({
      taxCents: 1141,
      tipCents: null,
      serviceChargeCents: null,
    });

    expect(result).toEqual({ taxCents: 1141, taxIsPercent: false });
  });

  it("maps a detected tip to a fixed amount", () => {
    const result = taxTipFromExtraction({
      taxCents: null,
      tipCents: 2852,
      serviceChargeCents: null,
    });

    expect(result).toEqual({ tipCents: 2852, tipIsPercent: false });
  });

  it("maps a detected service charge to a fixed amount", () => {
    const result = taxTipFromExtraction({
      taxCents: null,
      tipCents: null,
      serviceChargeCents: 2567,
    });

    expect(result?.serviceCents).toBe(2567);
    expect(result?.serviceIsPercent).toBe(false);
  });

  it("zeroes the tip when a service charge is detected", () => {
    // A service charge is normally auto-gratuity, so the 20% tip default would
    // stack on top of it and overcharge by roughly 20%.
    const result = taxTipFromExtraction({
      taxCents: null,
      tipCents: null,
      serviceChargeCents: 2567,
    });

    expect(result?.tipCents).toBe(0);
    expect(result?.tipPercent).toBe(0);
    expect(result?.tipIsPercent).toBe(false);
  });

  it("keeps a detected tip when the receipt lists both", () => {
    const result = taxTipFromExtraction({
      taxCents: null,
      tipCents: 500,
      serviceChargeCents: 2567,
    });

    expect(result?.tipCents).toBe(500);
    expect(result?.tipPercent).toBeUndefined();
    expect(result?.serviceCents).toBe(2567);
  });

  it("leaves the tip untouched when no service charge is detected", () => {
    const result = taxTipFromExtraction({
      taxCents: 1141,
      tipCents: null,
      serviceChargeCents: null,
    });

    expect(result?.tipCents).toBeUndefined();
    expect(result?.tipPercent).toBeUndefined();
  });
});
