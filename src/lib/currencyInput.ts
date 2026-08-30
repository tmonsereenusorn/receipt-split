import { isValidChargeAmount } from "./charges";

/**
 * Parsing for the currency text input.
 *
 * Extracted from the component so it can be unit-tested: Vitest runs in the
 * `node` environment here, with no jsdom, so React components cannot be.
 */

export interface CurrencyParseResult {
  /** Cents to commit, or null to revert to the current value. */
  cents: number | null;
}

/**
 * A complete decimal amount and nothing else.
 *
 * `parseFloat` is too permissive for a committed money value: it stops at the
 * first invalid character, so "12abc" would silently commit $12.00, and it
 * accepts "Infinity" and exponent notation, which produce amounts no receipt
 * can contain.
 */
const AMOUNT_PATTERN = /^-?\d*(\.\d*)?$/;

/**
 * Interpret what the user typed into a currency field.
 *
 * `allowNegative` is opt-in per field rather than global: a charge may be a
 * discount and must accept a negative, but a negative tip is meaningless, so
 * loosening the rule everywhere would let one be entered.
 *
 * Returning `null` reverts the field. Rejecting here rather than downstream is
 * deliberate: the mutation layer's range check throws, and mutations are
 * dispatched fire-and-forget, so a value that reaches it leaves the receipt
 * showing a wrong total with no error until reload.
 */
export function parseCurrencyInput(
  value: string,
  allowNegative: boolean
): CurrencyParseResult {
  const trimmed = value.trim();

  if (trimmed === "" || trimmed === "-" || trimmed === ".") {
    return { cents: null };
  }
  if (!AMOUNT_PATTERN.test(trimmed)) return { cents: null };

  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) return { cents: null };
  if (!allowNegative && parsed < 0) return { cents: null };

  const cents = Math.round(parsed * 100);
  // Same bound the storage and extraction layers enforce, applied here so an
  // out-of-range amount never reaches a mutation that would reject it.
  if (!isValidChargeAmount(cents)) return { cents: null };

  return { cents };
}
