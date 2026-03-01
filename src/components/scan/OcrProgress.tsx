"use client";

import { OcrProgress as OcrProgressType } from "@/types";
import { ProgressBar } from "@/components/ui/ProgressBar";

interface OcrProgressProps {
  progress: OcrProgressType | null;
}

const STATUS_LABELS: Record<string, string> = {
  loading: "Loading OCR engine...",
  "loading tesseract core": "Loading OCR engine...",
  "initializing tesseract": "Initializing...",
  "loading language traineddata": "Loading language data...",
  "initializing api": "Preparing...",
  "recognizing text": "Reading receipt...",
};

export function OcrProgressDisplay({ progress }: OcrProgressProps) {
  if (!progress) return null;

  const label =
    STATUS_LABELS[progress.status] || progress.status || "Processing...";

  return (
    <div className="w-full max-w-xs space-y-2">
      <ProgressBar progress={progress.progress} label={label} />
    </div>
  );
}
