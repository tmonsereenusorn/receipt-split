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
