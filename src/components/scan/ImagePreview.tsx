"use client";

interface ImagePreviewProps {
  dataUrl: string;
  onRetake: () => void;
}

export function ImagePreview({ dataUrl, onRetake }: ImagePreviewProps) {
  return (
    <div className="flex flex-col items-center gap-3 py-4">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={dataUrl}
        alt="Captured receipt"
        className="max-h-48 border border-ink-faded object-contain opacity-60"
      />
      <button
        type="button"
        onClick={onRetake}
        className="font-receipt text-base text-ink-muted underline hover:text-ink"
      >
        retake
      </button>
    </div>
  );
}
