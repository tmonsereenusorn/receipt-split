# Image Preprocessing Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add canvas-based image preprocessing (grayscale, contrast, resize) before OCR to normalize extraction quality across phone and laptop.

**Architecture:** New `src/lib/image.ts` utility with a `preprocessImage()` function that loads an image to canvas, resizes to a target width, converts to grayscale, and boosts contrast. Called inside `recognizeImage()` in `src/lib/ocr.ts` before `Tesseract.recognize()`. No UI changes.

**Tech Stack:** Native Canvas API, Tesseract.js v7 (accepts `HTMLCanvasElement`)

---

### Task 1: Create `preprocessImage` utility with tests

**Files:**
- Create: `src/lib/image.ts`
- Create: `src/lib/__tests__/image.test.ts`

**Step 1: Write the failing tests**

```typescript
// src/lib/__tests__/image.test.ts
import { describe, it, expect } from "vitest";
import { preprocessImage } from "../image";

// Note: These tests run in a Node environment where HTMLCanvasElement
// and HTMLImageElement are not available. We test the exported function
// exists and handles invalid input gracefully.

describe("preprocessImage", () => {
  it("is a function that accepts File | string", () => {
    expect(typeof preprocessImage).toBe("function");
  });

  it("returns a promise", () => {
    // In Node env without canvas, this will reject, but it should still return a promise
    const result = preprocessImage("data:image/png;base64,invalid");
    expect(result).toBeInstanceOf(Promise);
    // Clean up the rejection
    result.catch(() => {});
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `preprocessImage` not found

**Step 3: Write the implementation**

```typescript
// src/lib/image.ts

const TARGET_WIDTH = 1500;
const MAX_WIDTH = 2500;
const CONTRAST_FACTOR = 1.5;

/**
 * Load a File or data URL into an HTMLImageElement.
 */
function loadImage(source: File | string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load image"));

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
      img.src = source;
    }
  });
}

/**
 * Preprocess an image for OCR: resize, grayscale, contrast boost.
 * Returns an HTMLCanvasElement ready for Tesseract.recognize().
 */
export async function preprocessImage(
  source: File | string
): Promise<HTMLCanvasElement> {
  const img = await loadImage(source);

  // Calculate target dimensions
  let width = img.naturalWidth;
  let height = img.naturalHeight;

  if (width < TARGET_WIDTH || width > MAX_WIDTH) {
    const targetW = width < TARGET_WIDTH ? TARGET_WIDTH : MAX_WIDTH;
    const scale = targetW / width;
    width = targetW;
    height = Math.round(height * scale);
  }

  // Draw to canvas at target size
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, 0, 0, width, height);

  // Get pixel data
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;

  // Grayscale + contrast boost in a single pass
  for (let i = 0; i < data.length; i += 4) {
    // Luminance grayscale
    const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    // Contrast stretch
    const adjusted = Math.min(
      255,
      Math.max(0, (gray - 128) * CONTRAST_FACTOR + 128)
    );
    data[i] = adjusted;     // R
    data[i + 1] = adjusted; // G
    data[i + 2] = adjusted; // B
    // Alpha unchanged
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas;
}
```

**Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: All tests pass (the existing 26 + 2 new = 28)

**Step 5: Commit**

```bash
git add src/lib/image.ts src/lib/__tests__/image.test.ts
git commit -m "feat: add preprocessImage utility for OCR image optimization"
```

---

### Task 2: Integrate preprocessing into OCR pipeline

**Files:**
- Modify: `src/lib/ocr.ts`

**Step 1: Update `recognizeImage` to preprocess before OCR**

Replace the current `src/lib/ocr.ts` content:

```typescript
import Tesseract from "tesseract.js";
import { OcrProgress } from "@/types";
import { preprocessImage } from "./image";

/**
 * Run OCR on an image, reporting progress via callback.
 * Preprocesses the image (grayscale, contrast, resize) before recognition.
 * Uses Tesseract.js v7 simple API (no manual worker lifecycle).
 */
export async function recognizeImage(
  image: File | string,
  onProgress?: (progress: OcrProgress) => void
): Promise<string> {
  const canvas = await preprocessImage(image);

  const result = await Tesseract.recognize(canvas, "eng", {
    logger: (m: Tesseract.LoggerMessage) => {
      onProgress?.({
        status: m.status,
        progress: m.progress,
      });
    },
  });

  return result.data.text;
}
```

**Step 2: Run tests**

Run: `npm test`
Expected: All 28 tests pass

**Step 3: Run build**

Run: `npm run build`
Expected: Clean build

**Step 4: Commit**

```bash
git add src/lib/ocr.ts
git commit -m "feat: integrate image preprocessing into OCR pipeline"
```

---

### Task 3: Verify end-to-end

**Files:**
- No new files

**Step 1: Run tests**

Run: `npm test`
Expected: All 28 tests pass

**Step 2: Run build**

Run: `npm run build`
Expected: Clean build

**Step 3: Manual verification**

Run: `npm run dev`

Verify:
- Upload/capture a receipt image → OCR still works
- No visual regressions on screen
- PrintItemsList still hidden on screen
- Print preview still produces clean two-page PDF
