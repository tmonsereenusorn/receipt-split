"use client";

import { useRef } from "react";

interface ImageCaptureProps {
  onCapture: (file: File, dataUrl: string) => void;
}

export function ImageCapture({ onCapture }: ImageCaptureProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      onCapture(file, reader.result as string);
    };
    reader.readAsDataURL(file);
  }

  return (
    <div className="flex flex-col items-center gap-4 py-4">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleChange}
        className="hidden"
        aria-label="Capture receipt image"
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="w-full border-2 border-dashed border-ink-faded px-6 py-8 text-center transition-colors hover:border-ink"
      >
        <div className="font-receipt text-xl text-ink">[ SCAN RECEIPT ]</div>
        <div className="mt-1 font-receipt text-base text-ink-muted">tap to take a photo</div>
      </button>
    </div>
  );
}
