"use client";

import { useState } from "react";
import { useOcr } from "@/hooks/useOcr";
import { parseReceiptText, parseRestaurantName } from "@/lib/parser";
import { ImageCapture } from "@/components/scan/ImageCapture";
import { ImagePreview } from "@/components/scan/ImagePreview";
import { OcrProgressDisplay } from "@/components/scan/OcrProgress";
import { Section } from "./Section";
import { formatCents } from "@/lib/format";
import { ReceiptItem } from "@/types";

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
  const [parsedItems, setParsedItems] = useState<ReceiptItem[]>([]);

  async function handleCapture(file: File, dataUrl: string) {
    setImageDataUrl(dataUrl);

    const text = await ocr.recognize(file);
    if (text) {
      const items = parseReceiptText(text);
      const restaurantName = parseRestaurantName(text);
      setParsedItems(items);
      onScanResult({ items, restaurantName, ocrText: text, imageDataUrl: dataUrl });
    }
  }

  function handleRetake() {
    setImageDataUrl(null);
    setParsedItems([]);
  }

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
        <button
          type="button"
          onClick={onSkip}
          className="block w-full py-1 text-center text-xs text-zinc-600 hover:text-zinc-400"
        >
          skip scan, enter items manually →
        </button>
      )}
    </Section>
  );
}
