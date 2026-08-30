import { initialTip, ReceiptCharge, ReceiptItem, Tip } from "@/types";
import { getSubtotalCents } from "./calculator";
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
 * The shape receipts were stored in before charges existed: fixed tax and tip
 * field groups, plus the service group added later. Only read during migration.
 */
interface LegacyTaxTip {
  taxCents?: number;
  taxIsPercent?: boolean;
  taxPercent?: number;
  tipCents?: number;
  tipIsPercent?: boolean;
  tipPercent?: number;
  serviceCents?: number;
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
 * Convert a legacy tax/tip/service map into charges plus a tip.
 *
 * A legacy percent tax needs the subtotal to become cash, which the stored
 * items supply exactly. The amount then freezes: editing an item afterwards no
 * longer rescales it. That is the new model's intent — the tax printed on a
 * receipt does not change because a typo was corrected — but it is a visible
 * change on receipts already in use.
 */
function migrateLegacy(legacy: LegacyTaxTip, items: ReceiptItem[]): ReceiptMoney {
  const subtotal = getSubtotalCents(items);
  const charges: ReceiptCharge[] = [];

  const taxCents = legacy.taxIsPercent
    ? Math.round((subtotal * (legacy.taxPercent ?? 0)) / 100)
    : legacy.taxCents ?? 0;
  // Zero-valued legacy fields produce no charge, so migrated receipts don't
  // sprout $0.00 rows for tax or service they never had.
  if (taxCents > 0) {
    charges.push({ id: makeChargeId("Tax"), label: "Tax", amountCents: taxCents });
  }

  const serviceCents = legacy.serviceCents ?? 0;
  if (serviceCents > 0) {
    charges.push({
      id: makeChargeId("Service Charge"),
      label: "Service Charge",
      amountCents: serviceCents,
    });
  }

  return {
    charges,
    tip: {
      cents: legacy.tipCents ?? initialTip.cents,
      isPercent: legacy.tipIsPercent ?? initialTip.isPercent,
      percent: legacy.tipPercent ?? initialTip.percent,
    },
  };
}

/**
 * Read a receipt's money fields in whatever shape they are stored.
 *
 * Documents written before charges existed carry a `taxTip` map and no
 * `charges`; they convert here at the read boundary, so no migration job is
 * needed and writes self-heal into the new shape.
 */
export function normalizeReceiptMoney(
  raw: unknown,
  items: ReceiptItem[]
): ReceiptMoney {
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

  if (typeof doc.taxTip === "object" && doc.taxTip !== null) {
    return migrateLegacy(doc.taxTip as LegacyTaxTip, items);
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
