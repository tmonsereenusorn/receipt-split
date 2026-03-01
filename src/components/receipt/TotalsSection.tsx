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
      <div className="space-y-1.5 font-mono text-sm">
        <div className="flex justify-between text-zinc-400">
          <span>SUBTOTAL</span>
          <span className="text-zinc-300">{formatCents(subtotal)}</span>
        </div>
        <div className="flex justify-between text-zinc-400">
          <span>
            TAX{taxTip.taxIsPercent ? ` (${taxTip.taxPercent}%)` : ""}
          </span>
          <span className="text-zinc-300">{formatCents(tax)}</span>
        </div>
        <div className="flex justify-between text-zinc-400">
          <span>
            TIP{taxTip.tipIsPercent ? ` (${taxTip.tipPercent}%)` : ""}
          </span>
          <span className="text-zinc-300">{formatCents(tip)}</span>
        </div>
        <div className="text-xs text-zinc-600 select-none" aria-hidden="true">
          ================================
        </div>
        <div className="flex justify-between text-base font-bold text-zinc-100">
          <span>TOTAL</span>
          <span>{formatCents(total)}</span>
        </div>
      </div>
    </Section>
  );
}
