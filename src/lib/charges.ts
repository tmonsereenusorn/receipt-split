import { initialTip, ReceiptCharge, Tip } from "@/types";
import type { ExtractedCharge } from "./receiptExtraction";

/** The money half of a receipt: everything that is not an item. */
export interface ReceiptMoney {
  charges: ReceiptCharge[];
  tip: Tip;
}

/** The subset of an extraction result that determines charges. */
export interface ExtractionChargeInput {
  charges: ExtractedCharge[];
}

/**
 * Derive a charge id from its label.
 *
 * Deterministic rather than random so re-reading the same stored document
 * yields the same ids and React keys stay stable across renders. The index
 * disambiguates two charges that share a label.
 */
export function makeChargeId(label: string, index?: number): string {
  const slug = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return index === undefined ? `charge-${slug}` : `charge-${index}-${slug}`;
}

/**
 * A charge cannot exceed this magnitude in either direction.
 *
 * Now that negatives are legitimate (discounts), an unbounded amount could
 * drive the grand total below zero. $1,000,000 is far beyond any real receipt
 * line while still rejecting corrupt or adversarial values.
 */
const MAX_CHARGE_MAGNITUDE_CENTS = 100_000_000;

/** True if an amount is finite and within the magnitude bound. */
export function isValidChargeAmount(amountCents: number): boolean {
  return (
    Number.isFinite(amountCents) &&
    Math.abs(amountCents) <= MAX_CHARGE_MAGNITUDE_CENTS
  );
}

function isStoredCharge(value: unknown): value is ReceiptCharge {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as ReceiptCharge).id === "string" &&
    typeof (value as ReceiptCharge).label === "string" &&
    (value as ReceiptCharge).label.trim().length > 0 &&
    typeof (value as ReceiptCharge).amountCents === "number" &&
    isValidChargeAmount((value as ReceiptCharge).amountCents)
  );
}

function normalizeTip(raw: unknown): Tip {
  if (typeof raw !== "object" || raw === null) return initialTip;
  const tip = raw as Partial<Tip>;
  return {
    cents: typeof tip.cents === "number" ? tip.cents : initialTip.cents,
    isPercent:
      typeof tip.isPercent === "boolean" ? tip.isPercent : initialTip.isPercent,
    percent:
      typeof tip.percent === "number" ? tip.percent : initialTip.percent,
  };
}

/**
 * Read a receipt's money fields, guarding the storage boundary.
 *
 * Receipts written before charges existed are no longer supported; their
 * `taxTip` map is ignored and they read as having no charges. Carrying that
 * migration was the source of three data-loss defects, and the codebase now has
 * one shape rather than two.
 */
export function normalizeReceiptMoney(raw: unknown): ReceiptMoney {
  if (typeof raw !== "object" || raw === null) {
    return { charges: [], tip: initialTip };
  }

  const doc = raw as { charges?: unknown; tip?: unknown; taxTip?: unknown };

  if (Array.isArray(doc.charges)) {
    return {
      charges: doc.charges.filter(isStoredCharge),
      tip: normalizeTip(doc.tip),
    };
  }

  return { charges: [], tip: initialTip };
}

/**
 * Derive the stored charges implied by a scanned receipt, or null if it
 * reported none.
 *
 * This deliberately does NOT decide the tip. The tip is resolved once, in
 * `resolveInitialTip`, which weighs the setup answer against what the bill
 * printed. Two places deciding the tip is exactly how the earlier tip-zeroing
 * bugs arose.
 */
export function chargesFromExtraction(
  result: ExtractionChargeInput
): ReceiptCharge[] | null {
  if (result.charges.length === 0) return null;

  return result.charges.map((charge, index) => ({
    id: makeChargeId(charge.label, index),
    label: charge.label,
    amountCents: charge.amountCents,
  }));
}
