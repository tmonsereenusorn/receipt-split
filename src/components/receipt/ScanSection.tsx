"use client";

import { ImageCapture } from "@/components/scan/ImageCapture";
import { Section } from "./Section";
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

/** The scanner module itself failed to load, as opposed to the scan failing. */
class ScanChunkError extends Error {}

/**
 * The outcome of a scan, carrying the failure reason rather than just `null`.
 *
 * The route distinguishes seven failures — truncated, unreadable, empty,
 * refused, partial, unconfigured, timeout — and each carries advice specific to
 * it ("too many items, split it into two photos" is a different remedy from
 * "try a clearer photo"). Collapsing them to one message sends the user off to
 * re-shoot a receipt that will fail identically.
 */
export type ScanOutcome =
  | { ok: true; result: ScanResult }
  | { ok: false; message: string };

interface ScanSectionProps {
  /**
   * Fired the moment a photo is captured, handing up the in-flight scan so the
   * setup step can render while it runs.
   */
  onScanStarted: (promise: Promise<ScanOutcome>) => void;
  onSkip: () => void;
}

/**
 * Capture only. Once a photo is taken the parent switches to the setup step and
 * unmounts this, so progress, preview, and result UI would never be seen.
 */
export function ScanSection({ onScanStarted, onSkip }: ScanSectionProps) {
  function handleCapture(file: File, dataUrl: string) {
    // Started, not awaited: the caller shows the setup step immediately and
    // resolves this when the user continues. `recognizeImage` stays lazily
    // imported to keep it out of the landing page's initial bundle.
    const promise: Promise<ScanOutcome> = import("@/lib/ocr")
      // The import is caught separately from the request. A chunk-load failure
      // — flaky network, or a deploy that moved the chunk — rejects with
      // "Failed to fetch dynamically imported module: .../chunks/….js", which is
      // not copy written for a person to read.
      .catch(() => {
        throw new ScanChunkError();
      })
      .then(({ recognizeImage }) => recognizeImage(file))
      .then((result) => ({
        ok: true as const,
        result: {
          items: result.items,
          restaurantName: result.restaurantName,
          ocrText: null,
          imageDataUrl: dataUrl,
          charges: chargesFromExtraction(result) ?? [],
          parsedTipCents: result.tipCents,
          currency: result.currency,
        },
      }))
      .catch((err: unknown) => ({
        ok: false as const,
        message:
          err instanceof ScanChunkError
            ? "Couldn't load the scanner. Check your connection and try again."
            : err instanceof Error
              ? err.message
              : "Couldn't read that receipt. Try another photo.",
      }));

    onScanStarted(promise);
  }

  return (
    <Section>
      <ImageCapture onCapture={handleCapture} />

      <div className="flex justify-center px-4 pb-2 pt-2">
        <button
          type="button"
          onClick={onSkip}
          className="font-receipt text-base text-ink-muted underline transition-colors hover:text-ink"
        >
          manual entry
        </button>
      </div>
    </Section>
  );
}
