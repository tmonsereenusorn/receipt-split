import { initialTaxTip, TaxTip } from "@/types";

/**
 * The subset of an extraction result that determines tax, tip, and service.
 */
export interface ExtractionTaxTipInput {
  taxCents: number | null;
  tipCents: number | null;
  serviceChargeCents: number | null;
}

/**
 * Fill in any TaxTip field a stored receipt is missing.
 *
 * Receipts created before service charge support have a taxTip map without the
 * three service keys. Left alone, serviceCents would read back undefined and
 * propagate as NaN through every total on the receipt, not just ones with a
 * fee. Normalizing at the Firestore read boundary avoids a migration.
 */
export function normalizeTaxTip(
  raw: Partial<TaxTip> | null | undefined
): TaxTip {
  return { ...initialTaxTip, ...(raw ?? {}) };
}

/**
 * Derive the TaxTip overrides implied by a scanned receipt, or null if the
 * receipt reported no tax, tip, or service charge at all.
 */
export function taxTipFromExtraction(
  result: ExtractionTaxTipInput
): Partial<TaxTip> | null {
  const detectedAnything =
    result.taxCents != null ||
    result.tipCents != null ||
    result.serviceChargeCents != null;
  if (!detectedAnything) return null;

  const taxTip: Partial<TaxTip> = {};

  if (result.taxCents != null) {
    taxTip.taxCents = result.taxCents;
    taxTip.taxIsPercent = false;
  }

  if (result.tipCents != null) {
    taxTip.tipCents = result.tipCents;
    taxTip.tipIsPercent = false;
  }

  if (result.serviceChargeCents != null) {
    taxTip.serviceCents = result.serviceChargeCents;
    taxTip.serviceIsPercent = false;

    // A service charge is normally auto-gratuity, so the 20% tip default would
    // double-pay. Only zero the tip when the receipt did not report one itself.
    if (result.tipCents == null) {
      taxTip.tipCents = 0;
      taxTip.tipIsPercent = false;
      taxTip.tipPercent = 0;
    }
  }

  return taxTip;
}
