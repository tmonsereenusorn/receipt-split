# Image Preprocessing for OCR

## Context

OCR extraction quality differs between phone and laptop, even with the same image. On mobile, browser-captured photos may be lower effective resolution for receipt text, and the app currently passes raw images directly to Tesseract.js with zero preprocessing. Adding canvas-based preprocessing (grayscale, contrast, resize) before OCR will normalize quality across devices.

## Design Decisions

### Approach: Canvas Preprocessing in `ocr.ts`

New `src/lib/image.ts` utility with a single `preprocessImage()` function, called inside `recognizeImage()` before `Tesseract.recognize()`. No new dependencies — uses native Canvas API.

### Preprocessing Pipeline

`preprocessImage(image: File | string): Promise<HTMLCanvasElement>`

1. **Load** — Create `HTMLImageElement` from File/dataUrl, wait for `onload`
2. **Resize** — Draw to canvas at normalized width (1500px target, preserve aspect ratio). Scale up if smaller, scale down if much larger (4000px+).
3. **Grayscale** — Convert pixels via luminance: `0.299R + 0.587G + 0.114B`
4. **Contrast boost** — Stretch contrast: `clamp((value - 128) * 1.5 + 128, 0, 255)`

Returns `HTMLCanvasElement` — Tesseract.js v7 accepts this natively.

### Integration

- **`src/lib/ocr.ts`** — Call `preprocessImage(image)` before `Tesseract.recognize()`, pass the returned canvas
- **No changes** to `useOcr.ts`, `ScanSection.tsx`, or any UI components
- Preprocessing is invisible to the user (no progress indicator)

### Why Not OffscreenCanvas/Worker

Canvas pixel manipulation on a receipt-sized image takes ~10-50ms. Tesseract itself already uses web workers internally. The complexity of worker setup/message passing is not justified.
