"use client";

import { ReceiptItem, TaxTip } from "@/types";
import { formatCents } from "@/lib/format";
import { getSubtotalCents, getEffectiveTaxCents, getEffectiveTipCents } from "@/lib/calculator";
import { Section } from "./Section";

interface TotalsSectionProps {
  items: ReceiptItem[];
  taxTip: TaxTip;
}

export function TotalsSection({ items, taxTip }: TotalsSectionProps) {
  const subtotal = getSubtotalCents(items);
  const tax = getEffectiveTaxCents(taxTip, subtotal);
  const tip = getEffectiveTipCents(taxTip, subtotal);
  const total = subtotal + tax + tip;

  if (items.length === 0) return null;

  return (
    <Section>
      <div className="print-no-break space-y-1 font-receipt text-lg">
        <div className="receipt-separator text-sm" aria-hidden="true">
          ================================
        </div>
        <div className="print-muted flex items-baseline text-ink-muted">
          <span className="shrink-0 uppercase">SUBTOTAL</span>
          <span className="mx-1 flex-1 overflow-hidden whitespace-nowrap text-ink-faded" aria-hidden="true">{"·".repeat(50)}</span>
          <span className="shrink-0">{formatCents(subtotal)}</span>
        </div>
        <div className="print-muted flex items-baseline text-ink-muted">
          <span className="shrink-0 uppercase">
            TAX{taxTip.taxIsPercent ? ` (${taxTip.taxPercent}%)` : ""}
          </span>
          <span className="mx-1 flex-1 overflow-hidden whitespace-nowrap text-ink-faded" aria-hidden="true">{"·".repeat(50)}</span>
          <span className="shrink-0">{formatCents(tax)}</span>
        </div>
        <div className="print-muted flex items-baseline text-ink-muted">
          <span className="shrink-0 uppercase">
            TIP{taxTip.tipIsPercent ? ` (${taxTip.tipPercent}%)` : ""}
          </span>
          <span className="mx-1 flex-1 overflow-hidden whitespace-nowrap text-ink-faded" aria-hidden="true">{"·".repeat(50)}</span>
          <span className="shrink-0">{formatCents(tip)}</span>
        </div>
        <div className="receipt-separator text-sm" aria-hidden="true">
          ================================
        </div>
        <div className="flex items-baseline text-xl font-bold text-ink">
          <span className="shrink-0">TOTAL</span>
          <span className="mx-1 flex-1 overflow-hidden whitespace-nowrap text-ink-faded" aria-hidden="true">{"·".repeat(50)}</span>
          <span className="shrink-0">{formatCents(total)}</span>
        </div>
        <div className="receipt-separator text-sm" aria-hidden="true">
          ================================
        </div>
      </div>
    </Section>
  );
}
