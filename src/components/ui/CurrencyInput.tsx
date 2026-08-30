"use client";

import { useState, useEffect, useRef } from "react";
import { parseCurrencyInput } from "@/lib/currencyInput";

interface CurrencyInputProps {
  cents: number;
  onChangeCents: (cents: number) => void;
  className?: string;
  /**
   * Accept negative amounts. Opt-in per field: a charge may be a discount, but
   * a negative tip is meaningless.
   */
  allowNegative?: boolean;
}

/**
 * A dollar input that uses local string state while editing,
 * committing to integer cents only on blur or Enter.
 */
export function CurrencyInput({
  cents,
  onChangeCents,
  className,
  allowNegative = false,
}: CurrencyInputProps) {
  const [localValue, setLocalValue] = useState((cents / 100).toFixed(2));
  const isFocused = useRef(false);

  useEffect(() => {
    if (!isFocused.current) setLocalValue((cents / 100).toFixed(2));
  }, [cents]);

  function commit() {
    const { cents: newCents } = parseCurrencyInput(localValue, allowNegative);
    if (newCents === null) {
      setLocalValue((cents / 100).toFixed(2));
    } else {
      onChangeCents(newCents);
      setLocalValue((newCents / 100).toFixed(2));
    }
  }

  return (
    <input
      type="text"
      // A decimal keypad has no minus key on most mobile keyboards, so a field
      // that accepts discounts needs the full keyboard to be usable at all.
      inputMode={allowNegative ? "text" : "decimal"}
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
