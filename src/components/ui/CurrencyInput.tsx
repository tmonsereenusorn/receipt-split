"use client";

import { useState, useEffect, useRef } from "react";

interface CurrencyInputProps {
  cents: number;
  onChangeCents: (cents: number) => void;
  className?: string;
}

/**
 * A dollar input that uses local string state while editing,
 * committing to integer cents only on blur or Enter.
 */
export function CurrencyInput({
  cents,
  onChangeCents,
  className,
}: CurrencyInputProps) {
  const [localValue, setLocalValue] = useState((cents / 100).toFixed(2));
  const isFocused = useRef(false);

  useEffect(() => {
    if (!isFocused.current) setLocalValue((cents / 100).toFixed(2));
  }, [cents]);

  function commit() {
    const parsed = parseFloat(localValue);
    if (isNaN(parsed) || parsed < 0) {
      setLocalValue((cents / 100).toFixed(2));
    } else {
      const newCents = Math.round(parsed * 100);
      onChangeCents(newCents);
      setLocalValue((newCents / 100).toFixed(2));
    }
  }

  return (
    <input
      type="text"
      inputMode="decimal"
      value={localValue}
      onChange={(e) => setLocalValue(e.target.value)}
      onFocus={(e) => {
        isFocused.current = true;
        e.target.select();
      }}
      onBlur={() => {
        isFocused.current = false;
        commit();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.currentTarget.blur();
        }
      }}
      className={className}
    />
  );
}
