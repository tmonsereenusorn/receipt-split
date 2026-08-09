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

export interface ExtractedReceipt {
  restaurantName: string | null;
  items: ExtractedItem[];
  taxCents: number | null;
  tipCents: number | null;
  currency: string;
}

export type ExtractionFailureCode = "truncated" | "unreadable" | "empty";

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
};

function fail(code: ExtractionFailureCode): ExtractionOutcome {
  return { ok: false, code, message: FAILURE_MESSAGES[code] };
}

function parseAndValidate(text: string): ExtractedReceipt {
  const cleaned = text.replace(/^```(?:json)?\s*|\s*```$/g, "").trim();
  const parsed = JSON.parse(cleaned);

  if (typeof parsed !== "object" || parsed === null) {
    throw new Error("Expected a JSON object");
  }

  const restaurantName =
    typeof parsed.restaurantName === "string" ? parsed.restaurantName : null;

  const currency =
    typeof parsed.currency === "string" && parsed.currency.length === 3
      ? parsed.currency.toUpperCase()
      : "USD";

  if (!Array.isArray(parsed.items)) {
    return { restaurantName, items: [], taxCents: null, tipCents: null, currency };
  }

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

  const taxCents =
    typeof parsed.taxCents === "number" && parsed.taxCents >= 0
      ? Math.round(parsed.taxCents)
      : null;
  const tipCents =
    typeof parsed.tipCents === "number" && parsed.tipCents >= 0
      ? Math.round(parsed.tipCents)
      : null;

  return { restaurantName, items, taxCents, tipCents, currency };
}

/**
 * Turn a raw model reply into either receipt data or a specific failure.
 *
 * `stopReason` is checked before the text is parsed: a reply cut off at the
 * token cap is incomplete even in the rare case where it still parses, and
 * reporting it as success would silently drop the items that got cut.
 */
export function interpretExtraction(
  stopReason: string | null,
  responseText: string
): ExtractionOutcome {
  if (stopReason === "max_tokens") return fail("truncated");
  if (!responseText) return fail("empty");

  try {
    return { ok: true, data: parseAndValidate(responseText) };
  } catch {
    return fail("unreadable");
  }
}
