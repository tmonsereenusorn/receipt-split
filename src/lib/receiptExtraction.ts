import { isValidChargeAmount } from "./charges";

/**
 * Interpreting the model's reply to a receipt-extraction request.
 *
 * Kept separate from the API route so the outcome rules — success, truncated
 * output, unreadable image — are testable without making a network call.
 */

export interface ExtractedItem {
  name: string;
  quantity: number;
  /** Price of ONE unit, derived here from the printed line total. */
  priceCents: number;
}

/** An item line as the model transcribes it: the amount printed, not per unit. */
interface RawItem {
  name: string;
  quantity: number;
  lineTotalCents: number;
}

/** A non-item line that adds to the total: tax, service charge, any fee. */
export interface ExtractedCharge {
  /** Label as printed on the receipt */
  label: string;
  amountCents: number;
}

export interface ExtractedReceipt {
  restaurantName: string | null;
  items: ExtractedItem[];
  charges: ExtractedCharge[];
  tipCents: number | null;
  currency: string;
}

export type ExtractionFailureCode =
  | "truncated"
  | "unreadable"
  | "empty"
  | "refused"
  | "partial";

export type ExtractionOutcome =
  | { ok: true; data: ExtractedReceipt }
  | { ok: false; code: ExtractionFailureCode; message: string };

/**
 * Output token ceiling for one receipt.
 *
 * The model pretty-prints each line item as roughly 40 tokens, so the previous
 * 1024 cap truncated mid-item at ~32 items and the reply failed to parse. 8192
 * covers ~190 items, past any realistic receipt. Raising the cap costs nothing
 * on its own — billing is per token generated, not per token allowed.
 */
export const MAX_OUTPUT_TOKENS = 8192;

const FAILURE_MESSAGES: Record<ExtractionFailureCode, string> = {
  truncated:
    "This receipt has too many items to read in one pass. Try splitting it into two photos.",
  unreadable:
    "Couldn't read a receipt in that image. Try a clearer, straight-on photo.",
  empty: "No response from OCR service. Please try again.",
  refused:
    "The OCR service wouldn't read that image. Try a photo of just the receipt.",
  partial:
    "Only part of that receipt could be read. Try a clearer, straight-on photo.",
};

function fail(code: ExtractionFailureCode): ExtractionOutcome {
  return { ok: false, code, message: FAILURE_MESSAGES[code] };
}

/**
 * Pull the JSON body out of a model reply.
 *
 * The model is told to return bare JSON but sometimes wraps it in a fence, and
 * sometimes adds a sentence either side of that fence. Anchoring the fence to
 * the start and end of the string missed both of those, and the resulting parse
 * error was reported to the user as an unreadable photo.
 */
function extractJson(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenced) return fenced[1].trim();

  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start !== -1 && end > start) return text.slice(start, end + 1);

  return text.trim();
}

/** A parsed receipt plus the number of line items that failed validation. */
interface ParseResult {
  receipt: ExtractedReceipt;
  dropped: number;
}

function parseAndValidate(text: string): ParseResult {
  const parsed = JSON.parse(extractJson(text));

  // typeof [] === "object", so arrays need excluding explicitly: a bare array
  // reply is not a receipt, and letting it through produced an empty receipt
  // that the UI reported as a successful scan.
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("Expected a JSON object");
  }

  if (!Array.isArray(parsed.items)) {
    throw new Error("Expected an items array");
  }

  const restaurantName =
    typeof parsed.restaurantName === "string" ? parsed.restaurantName : null;

  const currency =
    typeof parsed.currency === "string" && parsed.currency.length === 3
      ? parsed.currency.toUpperCase()
      : "USD";

  // The model transcribes the amount printed on the line; the division happens
  // here. Asking a model to derive a unit price is asking it to do the one
  // thing it is worst at, on the number that decides what everyone pays — and
  // it got it wrong, returning the line total as the unit price so the app
  // charged 2x and 3x.
  const rawItems: RawItem[] = parsed.items
    .filter(
      (item: unknown): item is RawItem =>
        typeof item === "object" &&
        item !== null &&
        typeof (item as RawItem).name === "string" &&
        typeof (item as RawItem).quantity === "number" &&
        typeof (item as RawItem).lineTotalCents === "number" &&
        Number.isFinite((item as RawItem).quantity) &&
        Number.isFinite((item as RawItem).lineTotalCents) &&
        (item as RawItem).quantity > 0 &&
        (item as RawItem).lineTotalCents >= 0
    );

  // Which reading of the printed amount does the receipt's own total support?
  //
  // A line like "2 BEER 6.00" is genuinely ambiguous: 6.00 could be the price
  // of one beer or the total for two, and both appear on real receipts. Reading
  // it wrong is silent and costs real money in whichever direction it errs.
  // Only the printed total distinguishes them, and comparing against it is
  // arithmetic — so the model transcribes both and this decides.
  const printedTotal =
    typeof parsed.itemsTotalCents === "number" &&
    Number.isFinite(parsed.itemsTotalCents) &&
    parsed.itemsTotalCents > 0
      ? parsed.itemsTotalCents
      : null;

  const asLineTotals = rawItems.reduce((sum, i) => sum + i.lineTotalCents, 0);
  const asUnitPrices = rawItems.reduce(
    (sum, i) => sum + Math.max(1, Math.round(i.quantity)) * i.lineTotalCents,
    0
  );

  // A reading has to actually MATCH the printed total, not merely land closer
  // to it: a misread total would otherwise be enough to flip every price. The
  // slack covers per-line rounding, since a receipt can print rounded figures.
  const slack = Math.max(2, rawItems.length);
  const unitReadingMatches =
    printedTotal !== null && Math.abs(asUnitPrices - printedTotal) <= slack;
  const lineReadingMatches =
    printedTotal !== null && Math.abs(asLineTotals - printedTotal) <= slack;

  // Only switch when the per-unit reading fits and the default does not. If
  // neither fits, or both do — which happens when every line is a single unit,
  // where the two readings are identical — keep the documented default.
  const amountsArePerUnit = unitReadingMatches && !lineReadingMatches;

  const items: ExtractedItem[] = rawItems
    .map((item: RawItem) => {
      // Floored at 1, not just rounded. A weighed line — "0.4 kg Bulk Coffee
      // $6.00" — passed the quantity > 0 filter, rounded to 0, divided by zero,
      // and produced Infinity. JSON.stringify turns that into null, the write
      // succeeded, and the storage boundary then rejected the row on read: the
      // item vanished from the bill with no error at any layer.
      //
      // Clamping keeps the line and keeps its money right: one unit at the
      // printed line total is exactly what the receipt says that line cost.
      const quantity = Math.max(1, Math.round(item.quantity));
      return {
        name: item.name,
        quantity,
        // Rounded, so a line total that does not divide evenly can be out by up
        // to a cent per line — far better than the multiples it replaces.
        // When the amounts are per unit, the printed figure already IS the
        // unit price and dividing would halve it.
        priceCents: amountsArePerUnit
          ? Math.round(item.lineTotalCents)
          : Math.round(item.lineTotalCents / quantity),
      };
    });

  const tipCents =
    typeof parsed.tipCents === "number" && parsed.tipCents >= 0
      ? Math.round(parsed.tipCents)
      : null;

  // A malformed charges value yields no charges rather than throwing: the
  // receipt's items are still usable, and an absent key is the common case.
  const rawCharges: unknown[] = Array.isArray(parsed.charges)
    ? parsed.charges
    : [];

  const validCharges = rawCharges.filter(
    (charge: unknown): charge is ExtractedCharge =>
      typeof charge === "object" &&
      charge !== null &&
      typeof (charge as ExtractedCharge).label === "string" &&
      (charge as ExtractedCharge).label.trim().length > 0 &&
      typeof (charge as ExtractedCharge).amountCents === "number" &&
      // Bounded in both directions: negatives are legitimate (discounts), but
      // an unbounded one could drive the grand total below zero. Shares the
      // storage layer's bound rather than repeating the number.
      isValidChargeAmount((charge as ExtractedCharge).amountCents)
  );

  // Zero-amount charges are valid input but change nothing, so they are not
  // kept — storing one would render a $0.00 row. Negative amounts ARE kept: a
  // discount is a real receipt line, and dropping it would overstate the total.
  const charges: ExtractedCharge[] = validCharges
    .map((charge) => ({
      label: charge.label.trim(),
      amountCents: Math.round(charge.amountCents),
    }))
    .filter((charge) => charge.amountCents !== 0);

  return {
    receipt: { restaurantName, items, charges, tipCents, currency },
    // Only unusable ITEMS make a scan partial. A malformed charge is dropped and
    // the scan still succeeds: `partial` is unrecoverable — the same photo
    // reproduces it on every retry (see interpretExtraction below) — so failing
    // the whole scan over one bad charge line would make that receipt
    // permanently unscannable. A missing charge is visible in the totals and can
    // be re-added by hand; a failed scan cannot be recovered at all.
    dropped: parsed.items.length - items.length,
  };
}

/**
 * Turn a raw model reply into either receipt data or a specific failure.
 *
 * `stopReason` is checked before the text is parsed: a reply cut off at the
 * token cap is incomplete even in the rare case where it still parses, and
 * reporting it as success would silently drop the items that got cut.
 *
 * A refusal is separated from an empty reply because the two need opposite
 * advice: an empty reply is transient and worth retrying, a refusal will
 * reproduce on every retry of the same photo.
 *
 * Items that fail per-item validation are a failure too, for the same reason
 * truncation is: a receipt that parses but is missing three dishes would
 * otherwise be split as though it were complete.
 */
export function interpretExtraction(
  stopReason: string | null,
  responseText: string
): ExtractionOutcome {
  if (stopReason === "refusal") return fail("refused");
  if (stopReason === "max_tokens") return fail("truncated");
  if (!responseText) return fail("empty");

  try {
    const { receipt, dropped } = parseAndValidate(responseText);
    if (dropped > 0) return fail("partial");
    return { ok: true, data: receipt };
  } catch {
    return fail("unreadable");
  }
}
