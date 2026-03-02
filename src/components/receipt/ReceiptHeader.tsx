"use client";

import { useState } from "react";

interface ReceiptHeaderProps {
  restaurantName?: string | null;
}

export function ReceiptHeader({ restaurantName }: ReceiptHeaderProps) {
  const [timestamp] = useState(() => {
    const now = new Date();
    return `${now.toLocaleDateString("en-US", {
      month: "2-digit",
      day: "2-digit",
      year: "numeric",
    })} ${now.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    })}`;
  });

  const displayName = restaurantName || "Shplit";

  return (
    <div className="print-keep-with-next py-6 text-center">
      <h1 className="font-mono text-lg font-bold uppercase tracking-[0.25em] text-zinc-100">
        {displayName}
      </h1>
      <div className="print-decorative mt-1 font-mono text-xs text-zinc-600 select-none" aria-hidden="true">
        ================================
      </div>
      <p className="print-muted mt-2 font-mono text-xs text-zinc-500">
        {timestamp}
      </p>
    </div>
  );
}
