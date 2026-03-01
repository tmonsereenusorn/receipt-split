"use client";

import { Button } from "@/components/ui/Button";

interface ImagePreviewProps {
  dataUrl: string;
  onRetake: () => void;
}

export function ImagePreview({ dataUrl, onRetake }: ImagePreviewProps) {
  return (
    <div className="flex flex-col items-center gap-3">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={dataUrl}
        alt="Captured receipt"
        className="max-h-64 rounded-lg border border-gray-200 object-contain"
      />
      <Button variant="ghost" size="sm" onClick={onRetake}>
        Retake
      </Button>
    </div>
  );
}
