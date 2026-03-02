"use client";

export function OcrProgressDisplay({ isProcessing }: { isProcessing: boolean }) {
  if (!isProcessing) return null;

  return (
    <div className="w-full space-y-2 py-4 text-center">
      <div className="font-mono text-sm text-amber-500 animate-pulse">
        [ SCANNING... ]
      </div>
      <div className="text-xs text-zinc-500">reading your receipt</div>
    </div>
  );
}
