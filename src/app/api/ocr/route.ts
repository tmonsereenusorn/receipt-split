import { NextRequest, NextResponse } from "next/server";
import {
  interpretExtraction,
  MAX_OUTPUT_TOKENS,
} from "@/lib/receiptExtraction";

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-haiku-4-5-20251001";

const EXTRACTION_PROMPT = `Extract line items, charges, tip, and currency from this receipt image. Return JSON only, no markdown.

{
  "restaurantName": "string or null",
  "items": [
    { "name": "string", "quantity": number, "priceCents": number }
  ],
  "charges": [
    { "label": "string", "amountCents": number }
  ],
  "tipCents": number or null,
  "currency": "ISO 4217 code, e.g. USD, EUR, JPY"
}

Rules:
- priceCents is the unit price in integer cents (e.g., $12.99 -> 1299)
- Default quantity to 1 unless explicitly shown
- items: only things ordered. Exclude every charge, subtotal, total, discount, payment method line, date, address, and phone number
- charges: every non-item line that CHANGES the total - tax, service charge, service fee, delivery fee, bag fee, surcharges, auto-gratuity, discounts, promotions, comps, and anything similar
- label: copy the charge's wording from the receipt as printed, trimmed. Keep a printed percentage in the label (e.g. "Service Charge 18%"); do not convert it
- amountCents: the charge's cash amount in integer cents. Use a NEGATIVE number for anything that reduces the total, such as a discount, promotion, or comp (e.g. a $4.31 promo -> -431)
- Do not put subtotal or total in charges
- tipCents: a tip or gratuity the diner chose or wrote in, in integer cents, or null if not found. A tip goes here, never in charges
- currency: the ISO 4217 currency code detected from the receipt (look for symbols like $, EUR, ¥, £, or text). Default to "USD" if unclear
- If no items found, return an empty items array; if no charges found, return an empty charges array`;

/**
 * Every id for one receipt is minted in a single synchronous map, so Date.now()
 * is identical across them and the 4-char random suffix was the only thing
 * keeping them apart. At the ~190 items MAX_OUTPUT_TOKENS now allows that
 * collides often enough to matter, and a duplicate id cross-assigns diners:
 * fsToggleAssignment and fsUpdateItem both match every item with that id.
 * The index makes collisions within a receipt impossible.
 */
function makeId(index: number): string {
  return `item-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 8)}`;
}

// The model can spend up to MAX_OUTPUT_TOKENS generating a long receipt, which
// takes well past the old 30s budget. Keep the fetch abort under this ceiling.
export const maxDuration = 120;

export async function POST(request: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "OCR service not configured" },
      { status: 500 }
    );
  }

  let body: { image?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }

  const dataUrl = body.image;
  if (!dataUrl || typeof dataUrl !== "string") {
    return NextResponse.json(
      { error: "Missing image field" },
      { status: 400 }
    );
  }

  // Extract media type and raw base64 from data URI
  const match = dataUrl.match(/^data:(image\/\w+);base64,/);
  const mediaType = match?.[1] ?? "image/jpeg";
  const base64 = dataUrl.replace(/^data:image\/\w+;base64,/, "");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 110_000);

  let anthropicResponse: Response;
  try {
    anthropicResponse = await fetch(ANTHROPIC_URL, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: MAX_OUTPUT_TOKENS,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: mediaType,
                  data: base64,
                },
              },
              {
                type: "text",
                text: EXTRACTION_PROMPT,
              },
            ],
          },
        ],
      }),
    });
  } catch (err) {
    clearTimeout(timeout);
    if (err instanceof DOMException && err.name === "AbortError") {
      return NextResponse.json(
        { error: "OCR service timeout" },
        { status: 504 }
      );
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }

  if (!anthropicResponse.ok) {
    const err = await anthropicResponse.text();
    console.error("Anthropic API error:", err);
    return NextResponse.json(
      { error: "OCR service error" },
      { status: 502 }
    );
  }

  const anthropicData = await anthropicResponse.json();
  const stopReason: string | null = anthropicData.stop_reason ?? null;
  // Read the first text block rather than content[0]: a non-text leading block
  // would otherwise read as an empty reply and be reported as retryable.
  const responseText: string =
    (Array.isArray(anthropicData.content)
      ? anthropicData.content.find(
          (block: { type?: string }) => block?.type === "text"
        )?.text
      : undefined) ?? "";

  const outcome = interpretExtraction(stopReason, responseText);

  if (!outcome.ok) {
    console.error(
      `Receipt extraction failed (${outcome.code}), stop_reason=${stopReason}, ` +
        `output_tokens=${anthropicData.usage?.output_tokens}:`,
      // Truncated: a failed large-receipt reply is ~30KB of itemised purchase
      // detail, and the failing path is the large-receipt one by construction.
      responseText.slice(0, 500)
    );
    return NextResponse.json(
      { error: outcome.message, code: outcome.code },
      { status: 422 }
    );
  }

  const result = outcome.data;

  // Add id and assignedTo to each item
  const items = result.items.map((item, index) => ({
    ...item,
    id: makeId(index),
    assignedTo: [] as string[],
  }));

  return NextResponse.json({
    restaurantName: result.restaurantName,
    items,
    charges: result.charges,
    tipCents: result.tipCents,
    currency: result.currency,
  });
}
