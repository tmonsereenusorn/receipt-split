"use client";

import { useRef, useState, useCallback } from "react";

interface ImageCaptureProps {
  onCapture: (file: File, dataUrl: string) => void;
}

export function ImageCapture({ onCapture }: ImageCaptureProps) {
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  function handleFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      onCapture(file, reader.result as string);
    };
    reader.readAsDataURL(file);
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    handleFile(file);
  }

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith("image/")) {
      handleFile(file);
    }
  }, []);

  return (
    <div className="flex flex-col items-center gap-4 py-4">
      {/* Camera input (mobile) */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleChange}
        className="hidden"
        aria-label="Take a photo"
      />
      {/* Gallery input (all platforms) */}
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        onChange={handleChange}
        className="hidden"
        aria-label="Choose image from gallery"
      />

      {/* Drop zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`w-full border-2 border-dashed px-6 py-8 text-center transition-colors ${
          isDragOver ? "border-ink bg-ink/5" : "border-ink-faded"
        }`}
      >
        {isDragOver ? (
          <div className="font-receipt text-xl text-ink">[ DROP RECEIPT HERE ]</div>
        ) : (
          <>
            <div className="font-receipt text-xl text-ink">[ SCAN RECEIPT ]</div>
            <div className="mt-3 flex justify-center gap-6">
              <button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                className="font-receipt text-base text-ink-muted underline transition-colors hover:text-ink"
              >
                take photo
              </button>
              <button
                type="button"
                onClick={() => galleryInputRef.current?.click()}
                className="font-receipt text-base text-ink-muted underline transition-colors hover:text-ink"
              >
                choose image
              </button>
            </div>
            <div className="mt-1 font-receipt text-sm text-ink-faded">or drag &amp; drop</div>
          </>
        )}
      </div>
    </div>
  );
}
