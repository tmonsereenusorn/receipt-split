import { ReceiptItem } from "@/types";
import { formatCents } from "@/lib/format";
import { getSubtotalCents } from "@/lib/calculator";

interface PrintItemsListProps {
  items: ReceiptItem[];
}

export function PrintItemsList({ items }: PrintItemsListProps) {
  if (items.length === 0) return null;

  const subtotal = getSubtotalCents(items);

  return (
    <div className="print-only print-page-break">
      <h3 className="print-muted mb-3 text-xs font-medium uppercase tracking-wider">
        Items
      </h3>
      <div className="space-y-1">
        {items.map((item) => {
          const total = item.quantity * item.priceCents;
          return (
            <div key={item.id} className="flex items-center gap-2 font-mono text-sm">
              <span className="print-muted w-6 shrink-0 text-xs">
                {item.quantity}×
              </span>
              <span className="min-w-0 flex-1 truncate">{item.name}</span>
              <span className="shrink-0">{formatCents(total)}</span>
            </div>
          );
        })}
      </div>
      <div className="print-decorative mt-2 text-xs" aria-hidden="true">
        ================================
      </div>
      <div className="mt-1 flex justify-between font-mono text-sm font-bold">
        <span>SUBTOTAL</span>
        <span>{formatCents(subtotal)}</span>
      </div>
    </div>
  );
}
