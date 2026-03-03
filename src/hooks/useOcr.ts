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
