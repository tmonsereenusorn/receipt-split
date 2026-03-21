"use client";

import { useState, useEffect, useRef } from "react";

const COMMON_CURRENCIES = [
  "USD", "EUR", "GBP", "JPY", "CAD", "AUD", "CHF", "CNY",
  "KRW", "INR", "MXN", "BRL", "SGD", "HKD", "TWD",
];

interface ReceiptHeaderProps {
  restaurantName?: string | null;
  onChangeName?: (name: string) => void;
  currency?: string;
  onChangeCurrency?: (currency: string) => void;
  children?: React.ReactNode;
}

export function ReceiptHeader({ restaurantName, onChangeName, currency, onChangeCurrency, children }: ReceiptHeaderProps) {
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
      {onChangeCurrency && (() => {
        const options = currency && !COMMON_CURRENCIES.includes(currency)
          ? [currency, ...COMMON_CURRENCIES]
          : COMMON_CURRENCIES;
        return (
          <div className="no-print mt-1">
            <select
              value={currency}
              onChange={(e) => onChangeCurrency(e.target.value)}
              aria-label="Currency"
              className="bg-transparent font-receipt text-sm text-ink-muted focus:outline-none cursor-pointer"
            >
              {options.map((code) => (
                <option key={code} value={code}>{code}</option>
              ))}
            </select>
          </div>
        );
      })()}
      {children}
      <div className="print-decorative receipt-separator mt-2 text-sm select-none" aria-hidden="true">
        ================================
      </div>
    </div>
  );
}
