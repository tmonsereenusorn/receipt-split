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
