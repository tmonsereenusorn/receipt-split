"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useReceipt } from "@/hooks/useReceipt";
import { useOcr } from "@/hooks/useOcr";
import { parseReceiptText } from "@/lib/parser";
import { ImageCapture } from "@/components/scan/ImageCapture";
import { ImagePreview } from "@/components/scan/ImagePreview";
import { OcrProgressDisplay } from "@/components/scan/OcrProgress";
import { Button } from "@/components/ui/Button";

export default function ScanPage() {
  const router = useRouter();
  const receipt = useReceipt();
  const ocr = useOcr();
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);

  async function handleCapture(file: File, dataUrl: string) {
    setImageDataUrl(dataUrl);
    receipt.setImage(dataUrl);

    const text = await ocr.recognize(file);
    if (text) {
      receipt.setOcrText(text);
      const items = parseReceiptText(text);
      if (items.length > 0) {
        receipt.setItems(items);
      }
    }
  }

  function handleRetake() {
    setImageDataUrl(null);
  }

  function handleContinue() {
    router.push("/assign");
  }

  function handleSkipScan() {
    router.push("/assign");
  }

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold">Receipt Split</h1>
        <p className="mt-1 text-sm text-gray-500">
          Scan a receipt to get started
        </p>
      </div>

      {!imageDataUrl && !ocr.isProcessing && (
        <ImageCapture onCapture={handleCapture} />
      )}

      {imageDataUrl && !ocr.isProcessing && (
        <ImagePreview dataUrl={imageDataUrl} onRetake={handleRetake} />
      )}

      {ocr.isProcessing && (
        <OcrProgressDisplay progress={ocr.progress} />
      )}

      {ocr.error && (
        <p className="text-sm text-red-600">{ocr.error}</p>
      )}

      {ocr.result && !ocr.isProcessing && (
        <div className="w-full space-y-3">
          <div className="rounded-lg bg-gray-50 p-3">
            <p className="mb-1 text-xs font-medium text-gray-500">
              Found {receipt.items.length} item{receipt.items.length !== 1 ? "s" : ""}
            </p>
            {receipt.items.length === 0 && (
              <p className="text-xs text-gray-400">
                No items detected. You can add them manually on the next page.
              </p>
            )}
            {receipt.items.map((item) => (
              <div
                key={item.id}
                className="flex justify-between text-sm"
              >
                <span>{item.name}</span>
                <span className="text-gray-600">
                  ${(item.priceCents / 100).toFixed(2)}
                </span>
              </div>
            ))}
          </div>
          <Button onClick={handleContinue} className="w-full">
            Continue to Assign
          </Button>
        </div>
      )}

      {!ocr.isProcessing && !ocr.result && (
        <button
          type="button"
          onClick={handleSkipScan}
          className="text-sm text-gray-400 hover:text-gray-600"
        >
          Skip scan, enter items manually
        </button>
      )}
    </div>
  );
}
