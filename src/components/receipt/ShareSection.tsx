"use client";

import { useState, useEffect } from "react";
import { Section } from "./Section";

interface ShareSectionProps {
  shareText: string;
  csvText: string;
}

export function ShareSection({ shareText, csvText }: ShareSectionProps) {
  const [copied, setCopied] = useState(false);
  const [canShare, setCanShare] = useState(false);

  useEffect(() => {
    setCanShare(typeof navigator !== "undefined" && "share" in navigator);
  }, []);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(shareText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
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

  function handleExportCsv() {
    const blob = new Blob([csvText], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "receipt-split.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Section className="no-print">
      <div className="flex flex-wrap justify-center gap-2">
        <button
          type="button"
          onClick={handleCopy}
          className="rounded-lg bg-zinc-800 px-4 py-2 text-xs text-zinc-300 transition-colors hover:bg-zinc-700"
        >
          {copied ? "✓ copied" : "copy"}
        </button>
        {canShare && (
          <button
            type="button"
            onClick={handleShare}
            className="rounded-lg bg-zinc-800 px-4 py-2 text-xs text-zinc-300 transition-colors hover:bg-zinc-700"
          >
            share
          </button>
        )}
        <button
          type="button"
          onClick={() => window.print()}
          className="rounded-lg bg-zinc-800 px-4 py-2 text-xs text-zinc-300 transition-colors hover:bg-zinc-700"
        >
          pdf
        </button>
        <button
          type="button"
          onClick={handleExportCsv}
          className="rounded-lg bg-zinc-800 px-4 py-2 text-xs text-zinc-300 transition-colors hover:bg-zinc-700"
        >
          csv
        </button>
      </div>
    </Section>
  );
}
