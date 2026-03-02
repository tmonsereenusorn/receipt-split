# Google Cloud Vision Migration — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace Tesseract.js with Google Cloud Vision API for OCR, removing all Tesseract dead code.

**Architecture:** New Next.js API route proxies OCR requests to Google Vision REST API. Client sends base64 image to `/api/ocr`, server calls Vision API with `TEXT_DETECTION`, returns extracted text. Image resized client-side before upload to reduce payload size.

**Tech Stack:** Next.js App Router route handler, Google Cloud Vision REST API, Canvas API for resize

---

### Task 1: Create the API route

**Files:**
- Create: `src/app/api/ocr/route.ts`

**Step 1: Create the route handler**

```ts
import { NextRequest, NextResponse } from "next/server";

const VISION_URL = "https://vision.googleapis.com/v1/images:annotate";

export async function POST(request: NextRequest) {
  const apiKey = process.env.GOOGLE_CLOUD_VISION_API_KEY;
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
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const dataUrl = body.image;
  if (!dataUrl || typeof dataUrl !== "string") {
    return NextResponse.json({ error: "Missing image field" }, { status: 400 });
  }

  // Strip data URI prefix to get raw base64
  const base64 = dataUrl.replace(/^data:image\/\w+;base64,/, "");

  const visionResponse = await fetch(`${VISION_URL}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      requests: [
        {
          image: { content: base64 },
          features: [{ type: "TEXT_DETECTION" }],
        },
      ],
    }),
  });

  if (!visionResponse.ok) {
    const err = await visionResponse.text();
    console.error("Vision API error:", err);
    return NextResponse.json(
      { error: "OCR service error" },
      { status: 502 }
    );
  }

  const visionData = await visionResponse.json();
  const text =
    visionData.responses?.[0]?.textAnnotations?.[0]?.description ?? "";

  if (!text) {
    return NextResponse.json(
      { error: "No text detected in image" },
      { status: 422 }
    );
  }

  return NextResponse.json({ text });
}
```

**Step 2: Create `.env.local`**

```
GOOGLE_CLOUD_VISION_API_KEY=<your-key-here>
```

Also add `.env.local` to `.gitignore` if not already there.

**Step 3: Commit**

```bash
git add src/app/api/ocr/route.ts
git commit -m "feat: add Google Cloud Vision OCR API route"
```

---

### Task 2: Rewrite `src/lib/image.ts` — resize only, export base64

**Files:**
- Modify: `src/lib/image.ts`

**Step 1: Rewrite image.ts**

Replace the entire file with resize-only logic that returns a base64 data URL:

```ts
const MAX_WIDTH = 1500;

/**
 * Load a File or data URL into an HTMLImageElement.
 */
function loadImage(source: File | string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();

    if (source instanceof File) {
      const url = URL.createObjectURL(source);
      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve(img);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("Failed to load image"));
      };
      img.src = url;
    } else {
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Failed to load image"));
      img.src = source;
    }
  });
}

/**
 * Resize image if wider than MAX_WIDTH and return as a JPEG base64 data URL.
 * Also handles HEIC/any format by re-encoding through canvas.
 */
export async function prepareImageBase64(
  source: File | string
): Promise<string> {
  const img = await loadImage(source);

  let width = img.naturalWidth;
  let height = img.naturalHeight;

  if (width > MAX_WIDTH) {
    const scale = MAX_WIDTH / width;
    width = MAX_WIDTH;
    height = Math.round(height * scale);
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, 0, 0, width, height);

  return canvas.toDataURL("image/jpeg", 0.85);
}
```

**Step 2: Commit**

```bash
git add src/lib/image.ts
git commit -m "refactor: simplify image.ts to resize-only with base64 export"
```

---

### Task 3: Rewrite `src/lib/ocr.ts` — call API route

**Files:**
- Modify: `src/lib/ocr.ts`

**Step 1: Rewrite ocr.ts**

Replace the entire file:

```ts
import { prepareImageBase64 } from "./image";

/**
 * Run OCR on an image via the server-side Google Cloud Vision API route.
 * Resizes the image client-side before uploading.
 */
export async function recognizeImage(image: File | string): Promise<string> {
  const base64DataUrl = await prepareImageBase64(image);

  const response = await fetch("/api/ocr", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image: base64DataUrl }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "OCR failed");
  }

  return data.text;
}
```

**Step 2: Commit**

```bash
git add src/lib/ocr.ts
git commit -m "feat: switch OCR to Google Cloud Vision API route"
```

---

### Task 4: Simplify `useOcr` hook — remove progress tracking

**Files:**
- Modify: `src/hooks/useOcr.ts`

**Step 1: Rewrite useOcr.ts**

Replace the entire file:

```ts
"use client";

import { useState, useCallback } from "react";

export function useOcr() {
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const recognize = useCallback(async (image: File | string) => {
    setIsProcessing(true);
    setError(null);
    setResult(null);

    try {
      const { recognizeImage } = await import("@/lib/ocr");
      const text = await recognizeImage(image);
      setResult(text);
      return text;
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

**Step 2: Commit**

```bash
git add src/hooks/useOcr.ts
git commit -m "refactor: simplify useOcr hook, remove progress tracking"
```

---

### Task 5: Simplify `OcrProgress.tsx` — replace with loading spinner

**Files:**
- Modify: `src/components/scan/OcrProgress.tsx`

**Step 1: Rewrite OcrProgress.tsx**

Replace the entire file with a simple loading indicator:

```tsx
"use client";

export function OcrProgressDisplay({ isProcessing }: { isProcessing: boolean }) {
  if (!isProcessing) return null;

  return (
    <div className="w-full space-y-2 py-4 text-center">
      <div className="font-mono text-sm text-amber-500 animate-pulse">
        [ SCANNING... ]
      </div>
      <div className="text-xs text-zinc-500">reading your receipt</div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/scan/OcrProgress.tsx
git commit -m "refactor: replace Tesseract progress bar with simple loading indicator"
```

---

### Task 6: Update `ScanSection.tsx` — use new hook API

**Files:**
- Modify: `src/components/receipt/ScanSection.tsx`

**Step 1: Update ScanSection**

The `useOcr` hook no longer returns `progress`. Update the component to pass `isProcessing` to the new `OcrProgressDisplay`:

Change import line:
```ts
import { OcrProgressDisplay } from "@/components/scan/OcrProgress";
```

Change the progress display JSX from:
```tsx
{ocr.isProcessing && (
  <OcrProgressDisplay progress={ocr.progress} />
)}
```
to:
```tsx
{ocr.isProcessing && (
  <OcrProgressDisplay isProcessing={ocr.isProcessing} />
)}
```

**Step 2: Commit**

```bash
git add src/components/receipt/ScanSection.tsx
git commit -m "refactor: update ScanSection for new OCR hook API"
```

---

### Task 7: Remove `OcrProgress` type from types

**Files:**
- Modify: `src/types/index.ts`

**Step 1: Remove the OcrProgress interface**

Delete these lines from the end of `src/types/index.ts`:

```ts
export interface OcrProgress {
  status: string;
  progress: number;
}
```

**Step 2: Commit**

```bash
git add src/types/index.ts
git commit -m "refactor: remove unused OcrProgress type"
```

---

### Task 8: Remove Tesseract.js and cleanup config

**Files:**
- Modify: `package.json` (remove `tesseract.js`)
- Modify: `next.config.ts` (remove canvas alias)

**Step 1: Uninstall tesseract.js**

```bash
npm uninstall tesseract.js
```

**Step 2: Simplify next.config.ts**

Replace the entire file:

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {};

export default nextConfig;
```

**Step 3: Commit**

```bash
git add package.json package-lock.json next.config.ts
git commit -m "chore: remove tesseract.js dependency and canvas alias"
```

---

### Task 9: Add env var to `.env.local` and `.env.example`

**Files:**
- Create: `.env.example`
- Verify: `.env.local` exists with real key

**Step 1: Create `.env.example`**

```
GOOGLE_CLOUD_VISION_API_KEY=your-api-key-here
```

**Step 2: Verify `.gitignore` has `.env.local`**

Check that `.env.local` is in `.gitignore`. Next.js includes this by default.

**Step 3: Commit**

```bash
git add .env.example
git commit -m "docs: add .env.example for Google Cloud Vision API key"
```

---

### Task 10: Build and manual test

**Step 1: Run build**

```bash
npm run build
```

Expected: Clean build, no errors.

**Step 2: Run existing tests**

```bash
npm test
```

Expected: All 23 parser + calculator tests pass (OCR code has no unit tests).

**Step 3: Manual test**

```bash
npm run dev
```

1. Open app in browser
2. Upload/capture a receipt image
3. Verify text is extracted and items are parsed
4. Verify the loading indicator shows "SCANNING..." during OCR
5. Verify no Tesseract download occurs (check Network tab)

**Step 4: Final commit if any fixes needed**

---

### Task 11: Add Vercel environment variable

**Step 1: Add env var in Vercel dashboard**

Go to Vercel project > Settings > Environment Variables > Add:
- Key: `GOOGLE_CLOUD_VISION_API_KEY`
- Value: your API key
- Environments: Production, Preview, Development

This is a manual step, no code change needed.
