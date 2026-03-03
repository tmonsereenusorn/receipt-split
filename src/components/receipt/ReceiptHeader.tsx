"use client";

import { useState, useEffect, useRef } from "react";

interface ReceiptHeaderProps {
  restaurantName?: string | null;
  onChangeName?: (name: string) => void;
}

export function ReceiptHeader({ restaurantName, onChangeName }: ReceiptHeaderProps) {
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
  const [localName, setLocalName] = useState(displayName);
  const isFocused = useRef(false);

  useEffect(() => {
    if (!isFocused.current) setLocalName(restaurantName || "Shplit");
  }, [restaurantName]);

  return (
    <div className="print-keep-with-next py-6 text-center">
      {onChangeName ? (
        <input
          value={localName}
          onChange={(e) => setLocalName(e.target.value)}
          onFocus={(e) => {
            isFocused.current = true;
            e.target.select();
          }}
          onBlur={() => {
            isFocused.current = false;
            const trimmed = localName.trim();
            if (trimmed) {
              onChangeName(trimmed);
              setLocalName(trimmed);
            } else {
              setLocalName(displayName);
            }
          }}
          onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
          className="w-full bg-transparent text-center font-receipt text-2xl uppercase tracking-[0.15em] text-ink focus:outline-none"
          aria-label="Restaurant name"
        />
      ) : (
        <h1 className="font-receipt text-2xl uppercase tracking-[0.15em] text-ink">
          {displayName}
        </h1>
      )}
      <p className="print-muted mt-1 font-receipt text-base text-ink-muted">
        {timestamp}
      </p>
      <div className="print-decorative receipt-separator mt-2 text-sm select-none" aria-hidden="true">
        ================================
      </div>
    </div>
  );
}
