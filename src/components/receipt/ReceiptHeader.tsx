"use client";

import { useState } from "react";

export function ReceiptHeader() {
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

  return (
    <div className="py-6 text-center">
      <h1 className="font-mono text-lg font-bold uppercase tracking-[0.25em] text-zinc-100">
        Receipt Split
      </h1>
      <div className="mt-1 font-mono text-xs text-zinc-600 select-none" aria-hidden="true">
        ================================
      </div>
      <p className="mt-2 font-mono text-xs text-zinc-500">
        {timestamp}
      </p>
    </div>
  );
}
