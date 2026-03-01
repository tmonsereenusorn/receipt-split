"use client";

import { TaxTip } from "@/types";
import { Card } from "@/components/ui/Card";
import { CurrencyInput } from "@/components/ui/CurrencyInput";

interface TaxTipInputProps {
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
  return (
    <div>
      <div className="mb-1 flex items-center gap-2">
        <label className="text-xs text-gray-500">{label}</label>
        <div className="flex rounded-md border border-gray-300 text-xs">
          <button
            type="button"
            onClick={() => onToggleMode(false)}
            className={`px-2 py-0.5 ${!isPercent ? "bg-blue-100 text-blue-700" : "text-gray-500"}`}
          >
            $
          </button>
          <button
            type="button"
            onClick={() => onToggleMode(true)}
            className={`px-2 py-0.5 ${isPercent ? "bg-blue-100 text-blue-700" : "text-gray-500"}`}
          >
            %
          </button>
        </div>
      </div>
      {isPercent ? (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            {presets.map((pct) => (
              <button
                key={pct}
                type="button"
                onClick={() => onChangePercent(pct)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  percent === pct
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
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
              className="w-16 rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-400">%</span>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-1">
          <span className="text-sm text-gray-400">$</span>
          <CurrencyInput
            cents={cents}
            onChangeCents={onChangeCents}
            className="w-24 rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
      )}
    </div>
  );
}

export function TaxTipInput({ taxTip, onChange }: TaxTipInputProps) {
  return (
    <Card>
      <h3 className="mb-3 text-sm font-semibold text-gray-700">Tax & Tip</h3>
      <div className="space-y-4">
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
    </Card>
  );
}
