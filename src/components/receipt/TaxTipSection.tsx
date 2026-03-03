"use client";

import { useState, useEffect, useRef } from "react";
import { TaxTip } from "@/types";
import { formatCents } from "@/lib/format";
import { CurrencyInput } from "@/components/ui/CurrencyInput";
import { Section } from "./Section";

interface TaxTipSectionProps {
  taxTip: TaxTip;
  subtotalCents: number;
  onChange: (updates: Partial<TaxTip>) => void;
}

const TAX_PRESETS = [5, 7, 8, 10];
const TIP_PRESETS = [15, 18, 20, 25];

function PercentOrDollarInput({
  label,
  isPercent,
  percent,
  cents,
  presets,
  onToggleMode,
  onChangePercent,
  onChangeCents,
}: {
  label: string;
  isPercent: boolean;
  percent: number;
  cents: number;
  presets: number[];
  onToggleMode: (isPercent: boolean) => void;
  onChangePercent: (pct: number) => void;
  onChangeCents: (cents: number) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [localPercent, setLocalPercent] = useState(String(percent));
  const isPercentFocused = useRef(false);

  useEffect(() => {
    if (!isPercentFocused.current) setLocalPercent(String(percent));
  }, [percent]);

  return (
    <div>
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-baseline py-1 font-receipt text-lg text-ink"
      >
        <span className="shrink-0 uppercase">{label}</span>
        <span className="mx-1 flex-1 overflow-hidden whitespace-nowrap text-ink-faded" aria-hidden="true">
          {"·".repeat(50)}
        </span>
        <span className="shrink-0 text-ink-muted">{isPercent ? `${percent}%` : ''}</span>
        <span className="ml-2 shrink-0">{formatCents(cents)}</span>
      </button>

      {expanded && (
        <div className="space-y-2 pb-2 pt-1">
          {/* Mode toggle */}
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => onToggleMode(true)}
              className={`px-2 py-0.5 font-receipt text-sm ${
                isPercent ? "font-bold text-ink" : "text-ink-faded"
              }`}
            >
              %
            </button>
            <button
              type="button"
              onClick={() => onToggleMode(false)}
              className={`px-2 py-0.5 font-receipt text-sm ${
                !isPercent ? "font-bold text-ink" : "text-ink-faded"
              }`}
            >
              $
            </button>
          </div>

          {isPercent ? (
            <div className="space-y-2">
              <div className="flex flex-wrap gap-1.5">
                {presets.map((pct) => (
                  <button
                    key={pct}
                    type="button"
                    onClick={() => onChangePercent(pct)}
                    className={`px-3 py-1 font-receipt text-base transition-colors ${
                      percent === pct
                        ? "font-bold underline text-ink"
                        : "text-ink-muted hover:text-ink"
                    }`}
                  >
                    {pct}%
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  value={localPercent}
                  onChange={(e) => setLocalPercent(e.target.value)}
                  onFocus={() => { isPercentFocused.current = true; }}
                  onBlur={() => {
                    isPercentFocused.current = false;
                    const parsed = Math.max(0, parseFloat(localPercent) || 0);
                    setLocalPercent(String(parsed));
                    onChangePercent(parsed);
                  }}
                  onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
                  className="w-16 border-b-2 border-ink-faded bg-transparent px-1 py-1 font-receipt text-lg text-ink focus:border-ink focus:outline-none"
                />
                <span className="font-receipt text-sm text-ink-faded">%</span>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-1">
              <span className="font-receipt text-sm text-ink-faded">$</span>
              <CurrencyInput
                cents={cents}
                onChangeCents={onChangeCents}
                className="w-20 border-b-2 border-ink-faded bg-transparent px-1 py-1 font-receipt text-lg text-ink focus:border-ink focus:outline-none"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function TaxTipSection({ taxTip, subtotalCents, onChange }: TaxTipSectionProps) {
  const effectiveTaxCents = taxTip.taxIsPercent
    ? Math.round(subtotalCents * taxTip.taxPercent / 100)
    : taxTip.taxCents;
  const effectiveTipCents = taxTip.tipIsPercent
    ? Math.round(subtotalCents * taxTip.tipPercent / 100)
    : taxTip.tipCents;

  return (
    <Section>
      <div className="space-y-1">
        <PercentOrDollarInput
          label="Tax"
          isPercent={taxTip.taxIsPercent}
          percent={taxTip.taxPercent}
          cents={effectiveTaxCents}
          presets={TAX_PRESETS}
          onToggleMode={(isPercent) => onChange({ taxIsPercent: isPercent })}
          onChangePercent={(pct) => onChange({ taxPercent: pct })}
          onChangeCents={(cents) => onChange({ taxCents: cents })}
        />
        <PercentOrDollarInput
          label="Tip"
          isPercent={taxTip.tipIsPercent}
          percent={taxTip.tipPercent}
          cents={effectiveTipCents}
          presets={TIP_PRESETS}
          onToggleMode={(isPercent) => onChange({ tipIsPercent: isPercent })}
          onChangePercent={(pct) => onChange({ tipPercent: pct })}
          onChangeCents={(cents) => onChange({ tipCents: cents })}
        />
      </div>
    </Section>
  );
}
