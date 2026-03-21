import { ReceiptItem } from "@/types";
import { formatMoney } from "@/lib/currency";
import { getSubtotalCents } from "@/lib/calculator";

interface PrintItemsListProps {
  items: ReceiptItem[];
  currency: string;
}

export function PrintItemsList({ items, currency }: PrintItemsListProps) {
  if (items.length === 0) return null;

  const subtotal = getSubtotalCents(items);

  return (
    <div className="print-only print-page-break font-receipt">
      <h3 className="mb-3 font-receipt text-base uppercase text-ink-muted">
        Items
      </h3>
      <div className="space-y-1">
        {items.map((item) => {
          const total = item.quantity * item.priceCents;
          return (
            <div key={item.id} className="flex items-center gap-2 font-receipt text-base text-ink">
              <span className="w-6 shrink-0 text-ink-muted">
                {item.quantity}×
              </span>
              <span className="min-w-0 flex-1 truncate text-ink">{item.name}</span>
              <span className="shrink-0 text-ink">{formatMoney(total, currency)}</span>
            </div>
          );
        })}
      </div>
      <div className="receipt-separator mt-2 text-sm" aria-hidden="true">
        ================================
      </div>
      <div className="mt-1 flex justify-between font-receipt text-base font-bold text-ink">
        <span>SUBTOTAL</span>
        <span>{formatMoney(subtotal, currency)}</span>
      </div>
    </div>
  );
}
