"use client";

import { useState } from "react";
import { useOcr } from "@/hooks/useOcr";
import { ImageCapture } from "@/components/scan/ImageCapture";
import { ImagePreview } from "@/components/scan/ImagePreview";
import { OcrProgressDisplay } from "@/components/scan/OcrProgress";
import { Section } from "./Section";
import { formatMoney } from "@/lib/currency";
import type { ReceiptCharge, ReceiptItem } from "@/types";
import { chargesFromExtraction } from "@/lib/charges";

export interface ScanResult {
  items: ReceiptItem[];
  restaurantName: string | null;
  ocrText: string | null;
  imageDataUrl: string;
  charges: ReceiptCharge[];
  /**
   * The tip as printed on the bill, or null if none was found. Raw rather than
   * resolved: `resolveInitialTip` weighs it against the setup answer.
   */
  parsedTipCents: number | null;
  currency: string;
}

interface ScanSectionProps {
  /**
   * Fired the moment a photo is captured, handing up the in-flight scan so the
   * setup step can render while it runs. The promise resolves to null if the
   * scan fails; `scanError` on the hook carries the reason.
   */
  onScanStarted: (promise: Promise<ScanResult | null>, imageDataUrl: string) => void;
  onSkip: () => void;
}

export function ScanSection({ onScanStarted, onSkip }: ScanSectionProps) {
  const ocr = useOcr();
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);

  function handleCapture(file: File, dataUrl: string) {
    setImageDataUrl(dataUrl);

    // Started, not awaited: the caller shows the setup step immediately and
    // resolves this when the user continues.
    const promise = ocr.recognize(file).then((result) =>
      result
        ? {
            items: result.items,
            restaurantName: result.restaurantName,
            ocrText: null,
            imageDataUrl: dataUrl,
            charges: chargesFromExtraction(result) ?? [],
            parsedTipCents: result.tipCents,
            currency: result.currency,
          }
        : null
    );

    onScanStarted(promise, dataUrl);
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
              <span className="ml-2 text-ink">{formatMoney(item.priceCents, ocr.result?.currency ?? "USD")}</span>
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
