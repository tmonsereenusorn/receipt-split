"use client";

import { useState } from "react";
import { TaxTip } from "@/types";
import { CurrencyInput } from "@/components/ui/CurrencyInput";
import { Section } from "./Section";

interface TaxTipSectionProps {
  taxTip: TaxTip;
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
  const displayValue = isPercent ? `${percent}%` : `$${(cents / 100).toFixed(2)}`;

  return (
    <div>
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between py-1 text-sm"
      >
        <span className="text-zinc-400">{label}</span>
        <span className="font-mono text-zinc-200">{displayValue}</span>
      </button>

      {expanded && (
        <div className="space-y-2 pb-2 pt-1">
          {/* Mode toggle */}
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => onToggleMode(true)}
              className={`rounded px-2 py-0.5 font-mono text-xs ${
                isPercent ? "bg-amber-500/20 text-amber-500" : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              %
            </button>
            <button
              type="button"
              onClick={() => onToggleMode(false)}
              className={`rounded px-2 py-0.5 font-mono text-xs ${
                !isPercent ? "bg-amber-500/20 text-amber-500" : "text-zinc-500 hover:text-zinc-300"
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
                    className={`rounded-full px-3 py-1 font-mono text-xs transition-colors ${
                      percent === pct
                        ? "bg-amber-500 text-zinc-950 font-semibold"
                        : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
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
                  value={percent}
                  onChange={(e) =>
                    onChangePercent(
                      Math.max(0, parseFloat(e.target.value) || 0)
                    )
                  }
                  className="w-16 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 font-mono text-xs text-zinc-300 focus:border-amber-500 focus:outline-none"
                />
                <span className="font-mono text-xs text-zinc-500">%</span>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-1">
              <span className="font-mono text-xs text-zinc-500">$</span>
              <CurrencyInput
                cents={cents}
                onChangeCents={onChangeCents}
                className="w-20 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 font-mono text-xs text-zinc-300 focus:border-amber-500 focus:outline-none"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function TaxTipSection({ taxTip, onChange }: TaxTipSectionProps) {
  return (
    <Section>
      <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-zinc-500">
        Tax & Tip
      </h3>
      <div className="space-y-1">
        <PercentOrDollarInput
          label="Tax"
          isPercent={taxTip.taxIsPercent}
          percent={taxTip.taxPercent}
          cents={taxTip.taxCents}
          presets={TAX_PRESETS}
          onToggleMode={(isPercent) => onChange({ taxIsPercent: isPercent })}
          onChangePercent={(pct) => onChange({ taxPercent: pct })}
          onChangeCents={(cents) => onChange({ taxCents: cents })}
        />
        <PercentOrDollarInput
          label="Tip"
          isPercent={taxTip.tipIsPercent}
          percent={taxTip.tipPercent}
          cents={taxTip.tipCents}
          presets={TIP_PRESETS}
          onToggleMode={(isPercent) => onChange({ tipIsPercent: isPercent })}
          onChangePercent={(pct) => onChange({ tipPercent: pct })}
          onChangeCents={(cents) => onChange({ tipCents: cents })}
        />
      </div>
    </Section>
  );
}
