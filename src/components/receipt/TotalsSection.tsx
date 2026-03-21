"use client";

import { useState, useEffect, useRef } from "react";
import { ReceiptItem, TaxTip } from "@/types";
import { formatMoney, currencySymbol } from "@/lib/currency";
import { getSubtotalCents, getEffectiveTaxCents, getEffectiveTipCents } from "@/lib/calculator";
import { CurrencyInput } from "@/components/ui/CurrencyInput";
import { Section } from "./Section";

interface TotalsSectionProps {
  items: ReceiptItem[];
  taxTip: TaxTip;
  currency: string;
  onChange?: (updates: Partial<TaxTip>) => void;
  collapseKey?: number;
  onRowExpand?: () => void;
}

const TAX_PRESETS = [5, 7, 8, 10];
const TIP_PRESETS = [15, 18, 20, 25];

function EditableTaxTipRow({
  label,
  isPercent,
  percent,
  cents,
  presets,
  currency,
  onToggleMode,
  onChangePercent,
  onChangeCents,
  collapseKey,
  onExpand,
}: {
  label: string;
  isPercent: boolean;
  percent: number;
  cents: number;
  presets: number[];
  currency: string;
  onToggleMode: (isPercent: boolean) => void;
  onChangePercent: (pct: number) => void;
  onChangeCents: (cents: number) => void;
  collapseKey?: number;
  onExpand?: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    setExpanded(false);
  }, [collapseKey]);
  const [localPercent, setLocalPercent] = useState(String(percent));
  const isPercentFocused = useRef(false);

  useEffect(() => {
    if (!isPercentFocused.current) setLocalPercent(String(percent));
  }, [percent]);

  return (
    <div>
      <button
        type="button"
        onClick={() => {
          const next = !expanded;
          setExpanded(next);
          if (next) onExpand?.();
        }}
        className="print-muted flex w-full items-baseline font-receipt text-lg text-ink-muted"
      >
        <span className="shrink-0 uppercase">{label}</span>
        <span className="mx-1 flex-1 overflow-hidden whitespace-nowrap text-ink-faded" aria-hidden="true">
          {"·".repeat(50)}
        </span>
        {isPercent && <span className="shrink-0 text-ink-muted">{percent}%</span>}
        <span className={`shrink-0 ${isPercent ? "ml-2" : ""}`}>{formatMoney(cents, currency)}</span>
      </button>

      {expanded && (
        <div className="no-print space-y-2 pb-2 pt-1">
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
              {currencySymbol(currency)}
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
              <span className="font-receipt text-sm text-ink-faded">{currencySymbol(currency)}</span>
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

export function TotalsSection({ items, taxTip, currency, onChange, collapseKey, onRowExpand }: TotalsSectionProps) {
  const subtotal = getSubtotalCents(items);
  const tax = getEffectiveTaxCents(taxTip, subtotal);
  const tip = getEffectiveTipCents(taxTip, subtotal);
  const total = subtotal + tax + tip;

  if (items.length === 0) return null;

  return (
    <Section>
      <div className="print-no-break space-y-1 font-receipt text-lg">
        <div className="print-muted flex items-baseline text-ink-muted">
          <span className="shrink-0 uppercase">SUBTOTAL</span>
          <span className="mx-1 flex-1 overflow-hidden whitespace-nowrap text-ink-faded" aria-hidden="true">{"·".repeat(50)}</span>
          <span className="shrink-0">{formatMoney(subtotal, currency)}</span>
        </div>

        {onChange ? (
          <>
            <EditableTaxTipRow
              label="TAX"
              isPercent={taxTip.taxIsPercent}
              percent={taxTip.taxPercent}
              cents={tax}
              presets={TAX_PRESETS}
              currency={currency}
              onToggleMode={(isPercent) => onChange({ taxIsPercent: isPercent })}
              onChangePercent={(pct) => onChange({ taxPercent: pct })}
              onChangeCents={(cents) => onChange({ taxCents: cents })}
              collapseKey={collapseKey}
              onExpand={onRowExpand}
            />
            <EditableTaxTipRow
              label="TIP"
              isPercent={taxTip.tipIsPercent}
              percent={taxTip.tipPercent}
              cents={tip}
              presets={TIP_PRESETS}
              currency={currency}
              onToggleMode={(isPercent) => onChange({ tipIsPercent: isPercent })}
              onChangePercent={(pct) => onChange({ tipPercent: pct })}
              onChangeCents={(cents) => onChange({ tipCents: cents })}
              collapseKey={collapseKey}
              onExpand={onRowExpand}
            />
          </>
        ) : (
          <>
            <div className="print-muted flex items-baseline text-ink-muted">
              <span className="shrink-0 uppercase">
                TAX{taxTip.taxIsPercent ? ` (${taxTip.taxPercent}%)` : ""}
              </span>
              <span className="mx-1 flex-1 overflow-hidden whitespace-nowrap text-ink-faded" aria-hidden="true">{"·".repeat(50)}</span>
              <span className="shrink-0">{formatMoney(tax, currency)}</span>
            </div>
            <div className="print-muted flex items-baseline text-ink-muted">
              <span className="shrink-0 uppercase">
                TIP{taxTip.tipIsPercent ? ` (${taxTip.tipPercent}%)` : ""}
              </span>
              <span className="mx-1 flex-1 overflow-hidden whitespace-nowrap text-ink-faded" aria-hidden="true">{"·".repeat(50)}</span>
              <span className="shrink-0">{formatMoney(tip, currency)}</span>
            </div>
          </>
        )}

        <div className="flex items-baseline text-xl font-bold text-ink pt-1">
          <span className="shrink-0">TOTAL</span>
          <span className="mx-1 flex-1 overflow-hidden whitespace-nowrap text-ink-faded" aria-hidden="true">{"·".repeat(50)}</span>
          <span className="shrink-0">{formatMoney(total, currency)}</span>
        </div>
      </div>
    </Section>
  );
}
