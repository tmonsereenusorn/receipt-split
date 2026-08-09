import { NextRequest, NextResponse } from "next/server";
import {
  interpretExtraction,
  MAX_OUTPUT_TOKENS,
} from "@/lib/receiptExtraction";

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-haiku-4-5-20251001";

const EXTRACTION_PROMPT = `Extract line items, tax, tip, and currency from this receipt image. Return JSON only, no markdown.

{
  "restaurantName": "string or null",
  "items": [
    { "name": "string", "quantity": number, "priceCents": number }
  ],
  "taxCents": number or null,
  "tipCents": number or null,
  "currency": "ISO 4217 code, e.g. USD, EUR, JPY"
}

Rules:
- priceCents is the unit price in integer cents (e.g., $12.99 → 1299)
- Default quantity to 1 unless explicitly shown
- Exclude tax, tip, subtotal, total, discounts, service charges from items
- Exclude payment method lines, dates, addresses, phone numbers from items
- taxCents: the tax amount in integer cents, or null if not found
- tipCents: the tip/gratuity amount in integer cents, or null if not found
- currency: the ISO 4217 currency code detected from the receipt (look for currency symbols like $, €, ¥, £, or text). Default to "USD" if unclear.
- If no items found, return empty items array`;

function makeId(): string {
  return `item-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

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
  const timeout = setTimeout(() => controller.abort(), 30_000);

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
  const responseText: string = anthropicData.content?.[0]?.text ?? "";

  const outcome = interpretExtraction(stopReason, responseText);

  if (!outcome.ok) {
    console.error(
      `Receipt extraction failed (${outcome.code}), stop_reason=${stopReason}, ` +
        `output_tokens=${anthropicData.usage?.output_tokens}:`,
      responseText
    );
    return NextResponse.json(
      { error: outcome.message, code: outcome.code },
      { status: 422 }
    );
  }

  const result = outcome.data;

  // Add id and assignedTo to each item
  const items = result.items.map((item) => ({
    ...item,
    id: makeId(),
    assignedTo: [] as string[],
  }));

  return NextResponse.json({
    restaurantName: result.restaurantName,
    items,
    taxCents: result.taxCents,
    tipCents: result.tipCents,
    currency: result.currency,
  });
}
