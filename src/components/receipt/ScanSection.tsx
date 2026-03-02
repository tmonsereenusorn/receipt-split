"use client";

import { useState, useRef, useMemo } from "react";
import { useOcr } from "@/hooks/useOcr";
import { parseReceiptText, parseRestaurantName } from "@/lib/parser";
import { ImageCapture } from "@/components/scan/ImageCapture";
import { ImagePreview } from "@/components/scan/ImagePreview";
import { OcrProgressDisplay } from "@/components/scan/OcrProgress";
import { Section } from "./Section";
import { formatCents } from "@/lib/format";
import type { ReceiptItem } from "@/types";

export interface ScanResult {
  items: ReceiptItem[];
  restaurantName: string | null;
  ocrText: string;
  imageDataUrl: string;
}

interface ScanSectionProps {
  onScanResult: (result: ScanResult) => void;
  onSkip: () => void;
}

export function ScanSection({ onScanResult, onSkip }: ScanSectionProps) {
  const ocr = useOcr();
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  async function handleCapture(file: File, dataUrl: string) {
    setImageDataUrl(dataUrl);

    const text = await ocr.recognize(file);
    if (text) {
      const items = parseReceiptText(text);
      const restaurantName = parseRestaurantName(text);
      onScanResult({ items, restaurantName, ocrText: text, imageDataUrl: dataUrl });
    }
  }

  function handleRetake() {
    setImageDataUrl(null);
  }

  const parsedItems = useMemo(
    () => (ocr.result ? parseReceiptText(ocr.result) : []),
    [ocr.result]
  );

  return (
    <Section>
      {!imageDataUrl && !ocr.isProcessing && (
        <ImageCapture onCapture={handleCapture} />
      )}

      {imageDataUrl && !ocr.isProcessing && !ocr.result && (
        <ImagePreview dataUrl={imageDataUrl} onRetake={handleRetake} />
      )}

      {ocr.isProcessing && (
        <OcrProgressDisplay isProcessing={ocr.isProcessing} />
      )}

      {ocr.error && (
        <p className="py-2 text-center font-mono text-xs text-red-400">{ocr.error}</p>
      )}

      {ocr.result && !ocr.isProcessing && (
        <div className="space-y-2 py-2">
          <div className="font-mono text-xs text-green-500">
            ✓ {parsedItems.length} item{parsedItems.length !== 1 ? "s" : ""} detected
          </div>
          {parsedItems.map((item) => (
            <div
              key={item.id}
              className="flex justify-between font-mono text-xs text-zinc-400"
            >
              <span className="truncate">{item.name}</span>
              <span className="ml-2 text-zinc-300">{formatCents(item.priceCents)}</span>
            </div>
          ))}
        </div>
      )}

      {!ocr.isProcessing && !ocr.result && (
        <div className="flex gap-2 px-4 pb-2">
          <input
            ref={galleryInputRef}
            type="file"
            accept="image/*"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const reader = new FileReader();
              reader.onload = () => handleCapture(file, reader.result as string);
              reader.readAsDataURL(file);
            }}
            className="hidden"
            aria-label="Choose image from gallery"
          />
          <button
            type="button"
            onClick={() => galleryInputRef.current?.click()}
            className="flex-1 rounded border border-zinc-700 px-4 py-2 font-mono text-xs text-zinc-400 transition-colors hover:border-zinc-500 hover:text-zinc-300"
          >
            gallery
          </button>
          <button
            type="button"
            onClick={onSkip}
            className="flex-1 rounded border border-zinc-700 px-4 py-2 font-mono text-xs text-zinc-400 transition-colors hover:border-zinc-500 hover:text-zinc-300"
          >
            manual entry
          </button>
        </div>
      )}
    </Section>
  );
}
