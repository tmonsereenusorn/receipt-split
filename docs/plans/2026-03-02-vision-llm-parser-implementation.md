# Vision LLM Receipt Parser Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the Google Vision OCR + regex parser pipeline with a single Claude Haiku Vision API call that returns structured receipt data as JSON.

**Architecture:** The `/api/ocr` server route is rewritten to send the receipt image to Claude Haiku's vision API with a structured extraction prompt. Claude returns `{ restaurantName, items }` as JSON. The server validates the response, adds `id` and `assignedTo` fields to each item, and returns the structured data. The client chain (`ocr.ts` → `useOcr` → `ScanSection`) is updated to receive structured data instead of raw text. The regex parser is removed entirely.

**Tech Stack:** Anthropic Messages API (raw fetch, no SDK), Claude Haiku 4.5, Next.js API routes

---

### Task 1: Rewrite `/api/ocr` route for Claude Vision

**Files:**
- Modify: `src/app/api/ocr/route.ts`

**Step 1: Write the new route implementation**

Replace the entire contents of `src/app/api/ocr/route.ts` with:

```typescript
import { NextRequest, NextResponse } from "next/server";

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-haiku-4-5-20251001";

const EXTRACTION_PROMPT = `Extract line items from this receipt image. Return JSON only, no markdown.

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
- If no items found, return empty items array`;

interface RawItem {
  name: string;
  quantity: number;
  priceCents: number;
}

interface ClaudeResponse {
  restaurantName: string | null;
  items: RawItem[];
}

function makeId(): string {
  return `item-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

function parseAndValidate(text: string): ClaudeResponse {
  const parsed = JSON.parse(text);

  const restaurantName =
    typeof parsed.restaurantName === "string" ? parsed.restaurantName : null;

  if (!Array.isArray(parsed.items)) {
    return { restaurantName, items: [] };
  }

  const items: RawItem[] = parsed.items
    .filter(
      (item: unknown): item is RawItem =>
        typeof item === "object" &&
        item !== null &&
        typeof (item as RawItem).name === "string" &&
        typeof (item as RawItem).quantity === "number" &&
        typeof (item as RawItem).priceCents === "number" &&
        (item as RawItem).quantity > 0 &&
        (item as RawItem).priceCents >= 0
    )
    .map((item: RawItem) => ({
      name: item.name,
      quantity: Math.round(item.quantity),
      priceCents: Math.round(item.priceCents),
    }));

  return { restaurantName, items };
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

  // Strip data URI prefix to get raw base64
  const base64 = dataUrl.replace(/^data:image\/\w+;base64,/, "");

  const anthropicResponse = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: "image/jpeg",
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

  if (!anthropicResponse.ok) {
    const err = await anthropicResponse.text();
    console.error("Anthropic API error:", err);
    return NextResponse.json(
      { error: "OCR service error" },
      { status: 502 }
    );
  }

  const anthropicData = await anthropicResponse.json();
  const responseText = anthropicData.content?.[0]?.text ?? "";

  if (!responseText) {
    return NextResponse.json(
      { error: "No response from OCR service" },
      { status: 422 }
    );
  }

  let result: ClaudeResponse;
  try {
    result = parseAndValidate(responseText);
  } catch {
    console.error("Failed to parse Claude response:", responseText);
    return NextResponse.json(
      { error: "Failed to parse receipt data" },
      { status: 422 }
    );
  }

  // Add id and assignedTo to each item
  const items = result.items.map((item) => ({
    ...item,
    id: makeId(),
    assignedTo: [] as string[],
  }));

  return NextResponse.json({
    restaurantName: result.restaurantName,
    items,
  });
}
```

**Step 2: Run build to check for TypeScript errors**

Run: `npm run build`
Expected: Clean build

**Step 3: Commit**

```bash
git add src/app/api/ocr/route.ts
git commit -m "feat: replace Google Vision with Claude Haiku Vision API

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 2: Update client chain to receive structured data

**Files:**
- Modify: `src/lib/ocr.ts`
- Modify: `src/hooks/useOcr.ts`
- Modify: `src/components/receipt/ScanSection.tsx`

**Step 1: Update `src/lib/ocr.ts`**

Replace the entire contents with:

```typescript
import { prepareImageBase64 } from "./image";
import type { ReceiptItem } from "@/types";

export interface OcrResult {
  restaurantName: string | null;
  items: ReceiptItem[];
}

/**
 * Send a receipt image to the server-side Claude Vision API route.
 * Returns structured receipt data (restaurant name + parsed items).
 */
export async function recognizeImage(image: File | string): Promise<OcrResult> {
  const base64DataUrl = await prepareImageBase64(image);

  const response = await fetch("/api/ocr", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image: base64DataUrl }),
  });

  if (!response.ok) {
    let message = "OCR failed";
    try {
      const body = await response.json();
      message = body.error || message;
    } catch {
      message = `OCR failed (HTTP ${response.status})`;
    }
    throw new Error(message);
  }

  const data = await response.json();
  return {
    restaurantName: data.restaurantName ?? null,
    items: Array.isArray(data.items) ? data.items : [],
  };
}
```

**Step 2: Update `src/hooks/useOcr.ts`**

Replace the entire contents with:

```typescript
"use client";

import { useState, useCallback } from "react";
import type { OcrResult } from "@/lib/ocr";

export function useOcr() {
  const [result, setResult] = useState<OcrResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const recognize = useCallback(async (image: File | string) => {
    setIsProcessing(true);
    setError(null);
    setResult(null);

    try {
      const { recognizeImage } = await import("@/lib/ocr");
      const ocrResult = await recognizeImage(image);
      setResult(ocrResult);
      return ocrResult;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "OCR failed";
      setError(message);
      return null;
    } finally {
      setIsProcessing(false);
    }
  }, []);

  return { result, error, isProcessing, recognize };
}
```

**Step 3: Update `src/components/receipt/ScanSection.tsx`**

Replace the entire contents with:

```typescript
"use client";

import { useState, useRef } from "react";
import { useOcr } from "@/hooks/useOcr";
import { ImageCapture } from "@/components/scan/ImageCapture";
import { ImagePreview } from "@/components/scan/ImagePreview";
import { OcrProgressDisplay } from "@/components/scan/OcrProgress";
import { Section } from "./Section";
import { formatCents } from "@/lib/format";
import type { ReceiptItem } from "@/types";

export interface ScanResult {
  items: ReceiptItem[];
  restaurantName: string | null;
  ocrText: string | null;
  imageDataUrl: string;
}

interface ScanSectionProps {
  onScanResult: (result: ScanResult) => void;
  onSkip: () => void;
}

export function ScanSection({ onScanResult, onSkip }: ScanSectionProps) {
  const ocr = useOcr();
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  async function handleCapture(file: File, dataUrl: string) {
    setImageDataUrl(dataUrl);

    const result = await ocr.recognize(file);
    if (result) {
      onScanResult({
        items: result.items,
        restaurantName: result.restaurantName,
        ocrText: null,
        imageDataUrl: dataUrl,
      });
    }
  }

  function handleRetake() {
    setImageDataUrl(null);
  }

  return (
    <Section>
      {!imageDataUrl && !ocr.isProcessing && (
        <ImageCapture onCapture={handleCapture} />
      )}

      {imageDataUrl && !ocr.isProcessing && !ocr.result && (
        <ImagePreview dataUrl={imageDataUrl} onRetake={handleRetake} />
      )}

      {ocr.isProcessing && (
        <OcrProgressDisplay isProcessing={ocr.isProcessing} />
      )}

      {ocr.error && (
        <p className="py-2 text-center font-mono text-xs text-red-400">{ocr.error}</p>
      )}

      {ocr.result && !ocr.isProcessing && (
        <div className="space-y-2 py-2">
          <div className="font-mono text-xs text-green-500">
            ✓ {ocr.result.items.length} item{ocr.result.items.length !== 1 ? "s" : ""} detected
          </div>
          {ocr.result.items.map((item) => (
            <div
              key={item.id}
              className="flex justify-between font-mono text-xs text-zinc-400"
            >
              <span className="truncate">{item.name}</span>
              <span className="ml-2 text-zinc-300">{formatCents(item.priceCents)}</span>
            </div>
          ))}
        </div>
      )}

      {!ocr.isProcessing && !ocr.result && (
        <div className="flex gap-2 px-4 pb-2">
          <input
            ref={galleryInputRef}
            type="file"
            accept="image/*"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const reader = new FileReader();
              reader.onload = () => handleCapture(file, reader.result as string);
              reader.readAsDataURL(file);
            }}
            className="hidden"
            aria-label="Choose image from gallery"
          />
          <button
            type="button"
            onClick={() => galleryInputRef.current?.click()}
            className="flex-1 rounded border border-zinc-700 px-4 py-2 font-mono text-xs text-zinc-400 transition-colors hover:border-zinc-500 hover:text-zinc-300"
          >
            gallery
          </button>
          <button
            type="button"
            onClick={onSkip}
            className="flex-1 rounded border border-zinc-700 px-4 py-2 font-mono text-xs text-zinc-400 transition-colors hover:border-zinc-500 hover:text-zinc-300"
          >
            manual entry
          </button>
        </div>
      )}
    </Section>
  );
}
```

**Step 4: Run build**

Run: `npm run build`
Expected: Clean build

**Step 5: Commit**

```bash
git add src/lib/ocr.ts src/hooks/useOcr.ts src/components/receipt/ScanSection.tsx
git commit -m "feat: update client chain for structured OCR response

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 3: Remove dead code and update config

**Files:**
- Delete: `src/lib/parser.ts`
- Delete: `src/lib/__tests__/parser.test.ts`
- Modify: `.env.example`
- Modify: `src/lib/image.ts`

**Step 1: Delete the regex parser and its tests**

```bash
rm src/lib/parser.ts src/lib/__tests__/parser.test.ts
```

**Step 2: Update `.env.example`**

Replace the entire contents with:

```
ANTHROPIC_API_KEY=your-api-key-here
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
```

**Step 3: Update comment in `src/lib/image.ts`**

Change the comment on line 1 from:
```typescript
// Google Vision performs well at 1500px; higher adds bandwidth without accuracy gain
```
to:
```typescript
// 1500px is a good balance between OCR accuracy and bandwidth
```

**Step 4: Run tests**

Run: `npm test`
Expected: All remaining tests pass (calculator, format, image — parser tests removed)

**Step 5: Run build**

Run: `npm run build`
Expected: Clean build, no references to deleted parser

**Step 6: Commit**

```bash
git add -A
git commit -m "chore: remove regex parser, update env config for Anthropic API

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 4: Final verification

**Files:**
- No new files

**Step 1: Run tests**

Run: `npm test`
Expected: All tests pass (calculator + format + image)

**Step 2: Run build**

Run: `npm run build`
Expected: Clean build

**Step 3: Verify no dead imports**

Run: `grep -r "parser" src/ --include="*.ts" --include="*.tsx"`
Expected: No references to `parser.ts` or `parseReceiptText` or `parseRestaurantName`

Run: `grep -r "GOOGLE_CLOUD_VISION" src/ .env*`
Expected: No references to Google Cloud Vision

**Step 4: Manual verification**

Run: `npm run dev`

Verify:
- Add `ANTHROPIC_API_KEY` to `.env.local`
- Upload a receipt image → items extracted correctly as structured JSON
- Restaurant name detected
- "manual entry" button still works (skip OCR)
- No console errors
