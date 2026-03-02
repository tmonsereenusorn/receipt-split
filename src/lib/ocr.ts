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
  if (typeof data.text !== "string") {
    throw new Error("OCR response missing text field");
  }
  return data.text;
}
