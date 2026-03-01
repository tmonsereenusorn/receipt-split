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
        className="max-h-48 rounded border border-zinc-700 object-contain"
      />
      <button
        type="button"
        onClick={onRetake}
        className="text-xs text-zinc-500 hover:text-zinc-300"
      >
        retake
      </button>
    </div>
  );
}
