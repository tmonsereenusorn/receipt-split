"use client";

import { clsx } from "clsx";
import { InputHTMLAttributes } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export function Input({ label, className, id, ...props }: InputProps) {
  const inputId = id || label?.toLowerCase().replace(/\s+/g, "-");
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={inputId} className="font-receipt text-sm uppercase tracking-wider text-ink-muted">
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={clsx(
          "border-b-2 border-ink-faded bg-transparent px-3 py-2 font-receipt text-lg text-ink transition-colors placeholder:text-ink-faded focus:border-ink focus:outline-none",
          className
        )}
        {...props}
      />
    </div>
  );
}
