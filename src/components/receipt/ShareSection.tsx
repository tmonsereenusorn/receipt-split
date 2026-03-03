"use client";

import { useState } from "react";
import { Section } from "./Section";

interface ShareSectionProps {
  shareText?: string;
  csvText?: string;
}

export function ShareSection({ shareText, csvText }: ShareSectionProps) {
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedText, setCopiedText] = useState(false);
  const [canShare] = useState(() => typeof navigator !== "undefined" && "share" in navigator);

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
      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
        {copiedLink ? (
          <span className="font-receipt text-base font-bold text-ink">copied!</span>
        ) : (
          <button
            type="button"
            onClick={handleCopyLink}
            className="font-receipt text-base text-ink-muted underline decoration-ink-faded underline-offset-2 transition-colors hover:text-ink"
          >
            copy link
          </button>
        )}
        {canShare && (
          <button
            type="button"
            onClick={handleShare}
            className="font-receipt text-base text-ink-muted underline decoration-ink-faded underline-offset-2 transition-colors hover:text-ink"
          >
            share
          </button>
        )}
        {hasExportData && (
          <>
            {copiedText ? (
              <span className="font-receipt text-base font-bold text-ink">copied!</span>
            ) : (
              <button
                type="button"
                onClick={handleCopyText}
                className="font-receipt text-base text-ink-muted underline decoration-ink-faded underline-offset-2 transition-colors hover:text-ink"
              >
                copy split
              </button>
            )}
            <button
              type="button"
              onClick={() => window.print()}
              className="font-receipt text-base text-ink-muted underline decoration-ink-faded underline-offset-2 transition-colors hover:text-ink"
            >
              pdf
            </button>
            <button
              type="button"
              onClick={handleExportCsv}
              className="font-receipt text-base text-ink-muted underline decoration-ink-faded underline-offset-2 transition-colors hover:text-ink"
            >
              csv
            </button>
          </>
        )}
      </div>
    </Section>
  );
}
