"use client";

export function OcrProgressDisplay({ isProcessing }: { isProcessing: boolean }) {
  if (!isProcessing) return null;

  return (
    <div className="w-full space-y-2 py-4 text-center">
      <div className="font-receipt text-xl text-ink animate-pulse">
        [ SCANNING... ]
      </div>
      <div className="font-receipt text-base text-ink-muted">reading your receipt</div>
    </div>
  );
}
