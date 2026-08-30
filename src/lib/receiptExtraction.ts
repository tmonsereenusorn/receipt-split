/**
 * Interpreting the model's reply to a receipt-extraction request.
 *
 * Kept separate from the API route so the outcome rules — success, truncated
 * output, unreadable image — are testable without making a network call.
 */

export interface ExtractedItem {
  name: string;
  quantity: number;
  priceCents: number;
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

  const items: ExtractedItem[] = parsed.items
    .filter(
      (item: unknown): item is ExtractedItem =>
        typeof item === "object" &&
        item !== null &&
        typeof (item as ExtractedItem).name === "string" &&
        typeof (item as ExtractedItem).quantity === "number" &&
        typeof (item as ExtractedItem).priceCents === "number" &&
        (item as ExtractedItem).quantity > 0 &&
        (item as ExtractedItem).priceCents >= 0
    )
    .map((item: ExtractedItem) => ({
      name: item.name,
      quantity: Math.round(item.quantity),
      priceCents: Math.round(item.priceCents),
    }));

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
      Number.isFinite((charge as ExtractedCharge).amountCents)
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
