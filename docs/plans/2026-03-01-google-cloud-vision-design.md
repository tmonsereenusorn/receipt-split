# Google Cloud Vision OCR Migration

## Problem
Tesseract.js runs client-side WASM which is slow, downloads ~6MB of assets, and produces inconsistent results especially on mobile. Replacing it with Google Cloud Vision API gives better accuracy with no client-side processing cost.

## Design

### API Route: `src/app/api/ocr/route.ts`
- POST handler accepts `{ image: string }` (base64 data URL)
- Strips `data:image/...;base64,` prefix
- Calls `https://vision.googleapis.com/v1/images:annotate` with `TEXT_DETECTION`
- Returns `{ text: string }` or `{ error: string }`
- Reads `GOOGLE_CLOUD_VISION_API_KEY` from `process.env`

### Client OCR: `src/lib/ocr.ts`
- Rewrite to POST to `/api/ocr` instead of calling Tesseract
- Accepts `File | string`, converts to base64 via `image.ts`
- No progress callback (Vision API is a single fast request)

### Image utility: `src/lib/image.ts`
- Keep resize logic (cap at 1500px wide) to reduce upload size
- Remove grayscale/contrast pixel manipulation (Vision handles this)
- Export a `prepareImageBase64()` function that resizes and returns a base64 data URL

### Hook: `src/hooks/useOcr.ts`
- Keep `isProcessing`, `result`, `error`
- Remove granular `progress` state (no Tesseract stages)

### Progress UI: `src/components/scan/OcrProgress.tsx`
- Replace Tesseract stage labels + progress bar with a simple loading indicator

### Dead code removal
- Remove `tesseract.js` from package.json
- Remove `canvas: { browser: "" }` alias from `next.config.ts`
- Remove `OcrProgress.status` field from types (simplify to boolean)

### Environment
- `.env.local`: `GOOGLE_CLOUD_VISION_API_KEY=<key>`
- Same var in Vercel project environment variables

## Constraints
- Google Vision free tier: 1,000 requests/month
- Max 10MB JSON request (resize keeps us well under)
- `TEXT_DETECTION` feature (not `DOCUMENT_TEXT_DETECTION` — better for receipt prices)
