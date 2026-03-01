"use client";

import { OcrProgress as OcrProgressType } from "@/types";

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
  const pct = Math.round(progress.progress * 100);
  const filled = Math.round(progress.progress * 20);
  const empty = 20 - filled;
  const bar = "\u2588".repeat(filled) + "\u2591".repeat(empty);

  return (
    <div className="w-full space-y-2 py-4 text-center">
      <div className="font-mono text-sm text-amber-500">
        [{bar}] {pct}%
      </div>
      <div className="text-xs text-zinc-500">{label}</div>
    </div>
  );
}
