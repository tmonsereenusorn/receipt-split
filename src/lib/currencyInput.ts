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
 * Interpret what the user typed into a currency field.
 *
 * `allowNegative` is opt-in per field rather than global: a charge may be a
 * discount and must accept a negative, but a negative tip is meaningless, so
 * loosening the rule everywhere would let one be entered.
 */
export function parseCurrencyInput(
  value: string,
  allowNegative: boolean
): CurrencyParseResult {
  const parsed = parseFloat(value);

  if (Number.isNaN(parsed)) return { cents: null };
  if (!allowNegative && parsed < 0) return { cents: null };

  return { cents: Math.round(parsed * 100) };
}
