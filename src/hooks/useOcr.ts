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
