"use client";

import { useRef } from "react";
import { Button } from "@/components/ui/Button";

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
    <div className="flex flex-col items-center gap-4">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleChange}
        className="hidden"
        aria-label="Capture receipt image"
      />
      <Button
        size="lg"
        onClick={() => inputRef.current?.click()}
        className="w-full max-w-xs"
      >
        Take Photo
      </Button>
      <button
        type="button"
        onClick={() => {
          // Remove capture attribute for gallery access
          if (inputRef.current) {
            inputRef.current.removeAttribute("capture");
            inputRef.current.click();
            // Restore capture for next time
            setTimeout(() => {
              inputRef.current?.setAttribute("capture", "environment");
            }, 1000);
          }
        }}
        className="text-sm text-blue-600 hover:underline"
      >
        or choose from gallery
      </button>
    </div>
  );
}
