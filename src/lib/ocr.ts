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
