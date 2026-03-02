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
  const prevName = useRef(displayName);

  useEffect(() => {
    const name = restaurantName || "Shplit";
    if (!isFocused.current && name !== prevName.current) {
      setLocalName(name);
    }
    prevName.current = name;
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
          className="w-full bg-transparent text-center font-mono text-lg font-bold uppercase tracking-[0.25em] text-zinc-100 focus:outline-none"
          aria-label="Restaurant name"
        />
      ) : (
        <h1 className="font-mono text-lg font-bold uppercase tracking-[0.25em] text-zinc-100">
          {displayName}
        </h1>
      )}
      <div className="print-decorative mt-1 font-mono text-xs text-zinc-600 select-none" aria-hidden="true">
        ================================
      </div>
      <p className="print-muted mt-2 font-mono text-xs text-zinc-500">
        {timestamp}
      </p>
    </div>
  );
}
