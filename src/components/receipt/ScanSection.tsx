"use client";

import { useState } from "react";
import { useOcr } from "@/hooks/useOcr";
import { ImageCapture } from "@/components/scan/ImageCapture";
import { ImagePreview } from "@/components/scan/ImagePreview";
import { OcrProgressDisplay } from "@/components/scan/OcrProgress";
import { Section } from "./Section";
import { formatCents } from "@/lib/format";
import type { ReceiptItem, TaxTip } from "@/types";

export interface ScanResult {
  items: ReceiptItem[];
  restaurantName: string | null;
  ocrText: string | null;
  imageDataUrl: string;
  taxTip: Partial<TaxTip> | null;
}

interface ScanSectionProps {
  onScanResult: (result: ScanResult) => void;
  onSkip: () => void;
}

export function ScanSection({ onScanResult, onSkip }: ScanSectionProps) {
  const ocr = useOcr();
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);

  async function handleCapture(file: File, dataUrl: string) {
    setImageDataUrl(dataUrl);

    const result = await ocr.recognize(file);
    if (result) {
      const taxTip: Partial<TaxTip> | null =
        result.taxCents != null || result.tipCents != null
          ? {
              ...(result.taxCents != null && { taxCents: result.taxCents, taxIsPercent: false }),
              ...(result.tipCents != null && { tipCents: result.tipCents, tipIsPercent: false }),
            }
          : null;
      onScanResult({
        items: result.items,
        restaurantName: result.restaurantName,
        ocrText: null,
        imageDataUrl: dataUrl,
        taxTip,
      });
    }
  }

  function handleRetake() {
    setImageDataUrl(null);
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
        <p className="py-2 text-center font-receipt text-base text-accent">{ocr.error}</p>
      )}

      {ocr.result && !ocr.isProcessing && (
        <div className="space-y-2 py-2">
          <div className="font-receipt text-base text-ink">
            ✓ {ocr.result.items.length} item{ocr.result.items.length !== 1 ? "s" : ""} detected
          </div>
          {ocr.result.items.map((item) => (
            <div
              key={item.id}
              className="flex justify-between font-receipt text-base text-ink"
            >
              <span className="truncate">{item.name}</span>
              <span className="ml-2 text-ink">{formatCents(item.priceCents)}</span>
            </div>
          ))}
        </div>
      )}

      {!ocr.isProcessing && !ocr.result && (
        <div className="flex justify-center px-4 pb-2">
          <button
            type="button"
            onClick={onSkip}
            className="font-receipt text-base text-ink-muted underline transition-colors hover:text-ink"
          >
            manual entry
          </button>
        </div>
      )}
    </Section>
  );
}
