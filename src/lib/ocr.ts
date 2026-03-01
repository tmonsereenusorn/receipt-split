import Tesseract from "tesseract.js";
import { OcrProgress } from "@/types";

/**
 * Run OCR on an image, reporting progress via callback.
 * Uses Tesseract.js v7 simple API (no manual worker lifecycle).
 */
export async function recognizeImage(
  image: File | string,
  onProgress?: (progress: OcrProgress) => void
): Promise<string> {
  const result = await Tesseract.recognize(image, "eng", {
    logger: (m: Tesseract.LoggerMessage) => {
      onProgress?.({
        status: m.status,
        progress: m.progress,
      });
    },
  });

  return result.data.text;
}
