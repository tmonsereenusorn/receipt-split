"use client";

import { useState, useEffect } from "react";
import { Section } from "./Section";

interface ShareSectionProps {
  shareText?: string;
  csvText?: string;
}

export function ShareSection({ shareText, csvText }: ShareSectionProps) {
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedText, setCopiedText] = useState(false);
  const [canShare, setCanShare] = useState(false);

  useEffect(() => {
    setCanShare(typeof navigator !== "undefined" && "share" in navigator);
  }, []);

  const hasExportData = !!shareText;

  async function handleCopyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      /* noop */
    }
  }

  async function handleCopyText() {
    if (!shareText) return;
    try {
      await navigator.clipboard.writeText(shareText);
      setCopiedText(true);
      setTimeout(() => setCopiedText(false), 2000);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = shareText;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopiedText(true);
      setTimeout(() => setCopiedText(false), 2000);
    }
  }

  async function handleShare() {
    if (navigator.share) {
      try {
        await navigator.share({ url: window.location.href, text: shareText || undefined });
      } catch {
        // user cancelled
      }
    }
  }

  function handleExportCsv() {
    if (!csvText) return;
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
          onClick={handleCopyLink}
          className="rounded-lg bg-zinc-800 px-4 py-2 text-xs text-zinc-300 transition-colors hover:bg-zinc-700"
        >
          {copiedLink ? "✓ copied" : "copy link"}
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
        {hasExportData && (
          <>
            <button
              type="button"
              onClick={handleCopyText}
              className="rounded-lg bg-zinc-800 px-4 py-2 text-xs text-zinc-300 transition-colors hover:bg-zinc-700"
            >
              {copiedText ? "✓ copied" : "copy split"}
            </button>
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
          </>
        )}
      </div>
    </Section>
  );
}
