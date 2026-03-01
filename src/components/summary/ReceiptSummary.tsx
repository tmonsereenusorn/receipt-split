"use client";

import { ReceiptItem, TaxTip } from "@/types";
import { Card } from "@/components/ui/Card";
import { formatCents } from "@/lib/format";
import { getSubtotalCents, getEffectiveTaxCents, getEffectiveTipCents } from "@/lib/calculator";

interface ReceiptSummaryProps {
  items: ReceiptItem[];
  taxTip: TaxTip;
}

export function ReceiptSummary({ items, taxTip }: ReceiptSummaryProps) {
  const subtotal = getSubtotalCents(items);
  const taxCents = getEffectiveTaxCents(taxTip, subtotal);
  const tipCents = getEffectiveTipCents(taxTip, subtotal);
  const total = subtotal + taxCents + tipCents;

  return (
    <Card>
      <h3 className="mb-3 text-sm font-semibold text-gray-700">
        Receipt Total
      </h3>
      <div className="space-y-1.5 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-500">Subtotal</span>
          <span>{formatCents(subtotal)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Tax</span>
          <span>{formatCents(taxCents)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Tip</span>
          <span>{formatCents(tipCents)}</span>
        </div>
        <div className="flex justify-between border-t pt-1.5 font-bold">
          <span>Total</span>
          <span>{formatCents(total)}</span>
        </div>
      </div>
    </Card>
  );
}
