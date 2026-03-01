"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";

interface ShareActionsProps {
  shareText: string;
  csvText: string;
  onStartOver: () => void;
}

export function ShareActions({ shareText, csvText, onStartOver }: ShareActionsProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(shareText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
      const textarea = document.createElement("textarea");
      textarea.value = shareText;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  async function handleShare() {
    if (navigator.share) {
      try {
        await navigator.share({ text: shareText });
      } catch {
        // user cancelled
      }
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Button onClick={handleCopy} variant="secondary">
        {copied ? "Copied!" : "Copy to Clipboard"}
      </Button>
      {typeof navigator !== "undefined" && "share" in navigator && (
        <Button onClick={handleShare} variant="secondary">
          Share
        </Button>
      )}
      <Button onClick={() => window.print()} variant="secondary">
        Save as PDF
      </Button>
      <Button
        onClick={() => {
          const blob = new Blob([csvText], { type: "text/csv" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = "receipt-split.csv";
          a.click();
          URL.revokeObjectURL(url);
        }}
        variant="secondary"
      >
        Export CSV
      </Button>
      <Button onClick={onStartOver} variant="danger">
        Start Over
      </Button>
    </div>
  );
}
