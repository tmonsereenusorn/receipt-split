"use client";

import { useState, useEffect, useRef } from "react";
import { ReceiptCharge, ReceiptItem, Tip } from "@/types";
import { formatMoney, currencySymbol } from "@/lib/currency";
import {
  getSubtotalCents,
  getEffectiveTipCents,
  getChargesTotalCents,
} from "@/lib/calculator";
import { CurrencyInput } from "@/components/ui/CurrencyInput";
import { Section } from "./Section";

interface TotalsSectionProps {
  items: ReceiptItem[];
  charges: ReceiptCharge[];
  tip: Tip;
  currency: string;
  onChangeTip?: (updates: Partial<Tip>) => void;
  onUpdateCharge?: (chargeId: string, updates: Partial<Omit<ReceiptCharge, "id">>) => void;
  onDeleteCharge?: (chargeId: string) => void;
  onAddCharge?: (label: string, amountCents: number) => void;
  collapseKey?: number;
  onRowExpand?: () => void;
}

const TIP_PRESETS = [15, 18, 20, 25];

/**
 * A charge row. Cash only — charges have no percent mode, so this is far
 * simpler than the tip row, which exists to manage that toggle.
 */
function ChargeRow({
  charge,
  currency,
  onUpdate,
  onDelete,
  onExpand,
}: {
  charge: ReceiptCharge;
  currency: string;
  onUpdate?: (updates: Partial<Omit<ReceiptCharge, "id">>) => void;
  onDelete?: () => void;
  onExpand?: () => void;
}) {
  // Collapse is handled by remounting on collapseKey (see the key prop at the
  // call site) rather than a state-resetting effect, which the lint config
  // rejects.
  const [expanded, setExpanded] = useState(false);

  // Optimistic input state per docs/conventions/react-patterns.md: keep the
  // local value while focused, sync from props when not. Without this a
  // concurrent rename by another diner is reverted on blur, and this is a
  // real-time app with no auth, so concurrent editing is the normal case.
  const [localLabel, setLocalLabel] = useState(charge.label);
  const isLabelFocused = useRef(false);

  useEffect(() => {
    if (!isLabelFocused.current) setLocalLabel(charge.label);
  }, [charge.label]);

  const editable = Boolean(onUpdate);

  return (
    <div>
      <button
        type="button"
        disabled={!editable}
        onClick={() => {
          if (!editable) return;
          const next = !expanded;
          setExpanded(next);
          if (next) onExpand?.();
        }}
        className="print-muted flex w-full items-baseline font-receipt text-lg text-ink-muted"
      >
        <span className="min-w-0 max-w-[60%] truncate uppercase">{charge.label}</span>
        <span className="mx-1 flex-1 overflow-hidden whitespace-nowrap text-ink-faded" aria-hidden="true">
          {"·".repeat(50)}
        </span>
        <span className="shrink-0">{formatMoney(charge.amountCents, currency)}</span>
      </button>

      {expanded && editable && (
        <div className="no-print space-y-2 pb-2 pt-1">
          {/* The label carries the charge's category — it is the whole reason
              charges are generic — so it has to be editable, not just the
              amount. */}
          <input
            type="text"
            value={localLabel}
            aria-label="Charge name"
            placeholder="Charge name"
            onChange={(e) => setLocalLabel(e.target.value)}
            onFocus={() => {
              isLabelFocused.current = true;
            }}
            onBlur={() => {
              isLabelFocused.current = false;
              const trimmed = localLabel.trim();
              if (trimmed && trimmed !== charge.label) onUpdate?.({ label: trimmed });
              else setLocalLabel(charge.label);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
            }}
            className="w-full border-b-2 border-ink-faded bg-transparent px-1 py-1 font-receipt text-lg text-ink focus:border-ink focus:outline-none"
          />
          <div className="flex items-center gap-2">
            <span className="font-receipt text-sm text-ink-faded">{currencySymbol(currency)}</span>
            <CurrencyInput
              cents={charge.amountCents}
              onChangeCents={(cents) => onUpdate?.({ amountCents: cents })}
              className="w-20 border-b-2 border-ink-faded bg-transparent px-1 py-1 font-receipt text-lg text-ink focus:border-ink focus:outline-none"
            />
            <button
              type="button"
              onClick={onDelete}
              className="ml-auto px-2 py-1 font-receipt text-sm text-ink-faded hover:text-ink"
            >
              remove
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

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
  onExpand?: () => void;
}) {
  // Collapse happens by remounting on collapseKey (see the key prop at the call
  // site), matching ChargeRow. The previous state-resetting effect was two of
  // the repo's pre-existing lint errors.
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

export function TotalsSection({
  items,
  charges,
  tip,
  currency,
  onChangeTip,
  onUpdateCharge,
  onDeleteCharge,
  onAddCharge,
  collapseKey,
  onRowExpand,
}: TotalsSectionProps) {
  const subtotal = getSubtotalCents(items);
  const chargesTotal = getChargesTotalCents(charges);
  const tipCents = getEffectiveTipCents(tip, subtotal);
  const total = subtotal + chargesTotal + tipCents;

  if (items.length === 0) return null;

  return (
    <Section>
      <div className="print-no-break space-y-1 font-receipt text-lg">
        <div className="print-muted flex items-baseline text-ink-muted">
          <span className="shrink-0 uppercase">SUBTOTAL</span>
          <span className="mx-1 flex-1 overflow-hidden whitespace-nowrap text-ink-faded" aria-hidden="true">{"·".repeat(50)}</span>
          <span className="shrink-0">{formatMoney(subtotal, currency)}</span>
        </div>

        {charges.map((charge) => (
          <ChargeRow
            key={`${charge.id}-${collapseKey ?? 0}`}
            charge={charge}
            currency={currency}
            onUpdate={
              onUpdateCharge
                ? (updates) => onUpdateCharge(charge.id, updates)
                : undefined
            }
            onDelete={onDeleteCharge ? () => onDeleteCharge(charge.id) : undefined}
            onExpand={onRowExpand}
          />
        ))}

        {onChangeTip ? (
          <EditableTaxTipRow
            key={`tip-${collapseKey ?? 0}`}
            label="TIP"
            isPercent={tip.isPercent}
            percent={tip.percent}
            cents={tipCents}
            presets={TIP_PRESETS}
            currency={currency}
            onToggleMode={(isPercent) => onChangeTip({ isPercent })}
            onChangePercent={(percent) => onChangeTip({ percent })}
            onChangeCents={(cents) => onChangeTip({ cents })}
            onExpand={onRowExpand}
          />
        ) : (
          tipCents > 0 && (
            <div className="print-muted flex items-baseline text-ink-muted">
              <span className="shrink-0 uppercase">
                TIP{tip.isPercent ? ` (${tip.percent}%)` : ""}
              </span>
              <span className="mx-1 flex-1 overflow-hidden whitespace-nowrap text-ink-faded" aria-hidden="true">{"·".repeat(50)}</span>
              <span className="shrink-0">{formatMoney(tipCents, currency)}</span>
            </div>
          )
        )}

        {onAddCharge && (
          <button
            type="button"
            onClick={() => onAddCharge("New charge", 0)}
            className="no-print font-receipt text-sm text-ink-faded hover:text-ink"
          >
            + add charge
          </button>
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
