# Vision LLM Receipt Parser Design

**Goal:** Replace the Google Vision OCR + regex parser pipeline with a single Claude Haiku Vision API call that returns structured JSON directly from the receipt image.

**Problem:** The regex parser requires constant pattern maintenance and still misses receipt formats. An LLM can understand any receipt layout natively.

**Approach:** Send the receipt image to Claude Haiku's vision API with a structured extraction prompt. The server returns parsed items directly — no client-side text parsing needed.

## Section 1: API & Data Flow

Replace the 2-step pipeline (Google Vision OCR → regex parser) with a single Claude Haiku Vision call.

**New flow:**
1. Client resizes image → base64 (existing `prepareImageBase64()`)
2. Client POSTs base64 to `/api/ocr` (same endpoint, new implementation)
3. Server sends image to Claude Haiku with structured extraction prompt
4. Claude returns `{ restaurantName, items: [{ name, quantity, priceCents }] }`
5. Server validates response, adds `id` and `assignedTo` fields, returns structured data
6. Client receives structured data — no client-side parsing

**What changes:**
- `/api/ocr/route.ts` — rewrite to call Anthropic API instead of Google Vision
- `ScanSection.tsx` — receive structured data instead of running `parseReceiptText()`
- `useOcr.ts` — return type changes from string to structured object
- `ocr.ts` — return structured data instead of raw text
- `.env.local` — swap `GOOGLE_CLOUD_VISION_API_KEY` for `ANTHROPIC_API_KEY`

**What stays:**
- `prepareImageBase64()` in `image.ts`
- `ReceiptItem` type
- Firestore flow
- All UI components

**Dead code to remove:**
- `parser.ts` (regex parser)
- `parser.test.ts`
- Google Vision API dependency

## Section 2: Claude Prompt & Response Schema

**Prompt:**
```
Extract line items from this receipt image. Return JSON only, no markdown.

{
  "restaurantName": "string or null",
  "items": [
    { "name": "string", "quantity": number, "priceCents": number }
  ]
}

Rules:
- priceCents is the unit price in integer cents (e.g., $12.99 → 1299)
- Default quantity to 1 unless explicitly shown
- Exclude tax, tip, subtotal, total, discounts, service charges
- Exclude payment method lines, dates, addresses, phone numbers
- If no items found, return empty items array
```

**Model:** `claude-haiku-4-5-20251001`

**Response handling:**
- Parse JSON from Claude's response text
- Validate: `items` is array, each has `name` (string), `quantity` (positive int), `priceCents` (non-negative int)
- Generate `id` and `assignedTo: []` server-side
- Malformed JSON or validation failure → 422 error

**Error cases:**
- No API key → 500
- Anthropic API error → 502
- No items extracted → empty array (not error)
- Malformed response → 422

## Section 3: ScanSection Changes

**New API response shape from `/api/ocr`:**
```typescript
{
  restaurantName: string | null;
  items: ReceiptItem[];
}
```

**Changes:**
- Remove `parseReceiptText` and `parseRestaurantName` imports
- `useOcr` hook returns structured object instead of raw text string
- `ocrText` in `ScanResult` becomes `null` (no raw text from LLM)
- `onScanResult` receives items directly from API

**`ScanResult` type update:**
```typescript
export interface ScanResult {
  items: ReceiptItem[];
  restaurantName: string | null;
  ocrText: string | null;  // always null, kept for Firestore compat
  imageDataUrl: string;
}
```

**Files touched:** `ScanSection.tsx`, `useOcr.ts`, `ocr.ts`
