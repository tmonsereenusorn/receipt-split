"use client";

import { useState, useCallback } from "react";
import { OcrProgress } from "@/types";

export function useOcr() {
  const [progress, setProgress] = useState<OcrProgress | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const recognize = useCallback(async (image: File | string) => {
    setIsProcessing(true);
    setError(null);
    setResult(null);
    setProgress({ status: "loading", progress: 0 });

    try {
      // Dynamic import to avoid SSR issues
      const { recognizeImage } = await import("@/lib/ocr");
      const text = await recognizeImage(image, setProgress);
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

  return { progress, result, error, isProcessing, recognize };
}
