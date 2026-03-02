import { PersonBreakdown, ReceiptItem, TaxTip } from "@/types";
import { getEffectiveTaxCents, getEffectiveTipCents, getSubtotalCents } from "./calculator";

/**
 * Format cents as a dollar string, e.g. 1299 → "$12.99"
 */
export function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

/**
 * Format cents as a raw number string without $, e.g. 1299 → "12.99"
 */
export function formatCentsRaw(cents: number): string {
  return (cents / 100).toFixed(2);
}

/**
 * Generate a shareable text summary of the receipt split.
 */
export function generateShareText(
  items: ReceiptItem[],
  taxTip: TaxTip,
  breakdowns: PersonBreakdown[]
): string {
  const subtotal = getSubtotalCents(items);
  const taxCents = getEffectiveTaxCents(taxTip, subtotal);
  const tipCents = getEffectiveTipCents(taxTip, subtotal);
  const grandTotal = subtotal + taxCents + tipCents;

  const lines: string[] = [
    "Shplit",
    "─".repeat(30),
    `Subtotal: ${formatCents(subtotal)}`,
    `Tax: ${formatCents(taxCents)}`,
    `Tip: ${formatCents(tipCents)}`,
    `Total: ${formatCents(grandTotal)}`,
    "",
    "Per Person:",
    "─".repeat(30),
  ];

  for (const b of breakdowns) {
    lines.push(`${b.person.name}: ${formatCents(b.totalCents)}`);
    for (const pi of b.items) {
      const splitNote =
        pi.splitCount > 1 ? ` (1/${pi.splitCount})` : "";
      lines.push(`  • ${pi.item.name}${splitNote}: ${formatCents(pi.shareCents)}`);
    }
    if (b.taxShareCents > 0) {
      lines.push(`  • Tax: ${formatCents(b.taxShareCents)}`);
    }
    if (b.tipShareCents > 0) {
      lines.push(`  • Tip: ${formatCents(b.tipShareCents)}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

/**
 * Generate a CSV export of the receipt split.
 */
export function generateCsv(
  items: ReceiptItem[],
  taxTip: TaxTip,
  breakdowns: PersonBreakdown[]
): string {
  const subtotal = getSubtotalCents(items);
  const taxCents = getEffectiveTaxCents(taxTip, subtotal);
  const tipCents = getEffectiveTipCents(taxTip, subtotal);

  const rows: string[][] = [];

  // Header
  const personNames = breakdowns.map((b) => b.person.name);
  rows.push(["Item", "Qty", "Price", "Total", ...personNames]);

  // Item rows
  for (const item of items) {
    const row = [
      `"${item.name.replace(/"/g, '""')}"`,
      String(item.quantity),
      formatCentsRaw(item.priceCents),
      formatCentsRaw(item.quantity * item.priceCents),
    ];
    for (const b of breakdowns) {
      const pi = b.items.find((i) => i.item.id === item.id);
      row.push(pi ? formatCentsRaw(pi.shareCents) : "");
    }
    rows.push(row);
  }

  // Subtotal row
  rows.push(["Subtotal", "", "", formatCentsRaw(subtotal), ...breakdowns.map((b) => formatCentsRaw(b.subtotalCents))]);
  // Tax row
  rows.push(["Tax", "", "", formatCentsRaw(taxCents), ...breakdowns.map((b) => formatCentsRaw(b.taxShareCents))]);
  // Tip row
  rows.push(["Tip", "", "", formatCentsRaw(tipCents), ...breakdowns.map((b) => formatCentsRaw(b.tipShareCents))]);
  // Total row
  const grandTotal = subtotal + taxCents + tipCents;
  rows.push(["Total", "", "", formatCentsRaw(grandTotal), ...breakdowns.map((b) => formatCentsRaw(b.totalCents))]);

  return rows.map((r) => r.join(",")).join("\n");
}

/**
 * Format a timestamp as a relative time string, e.g. "just now", "5m ago", "3h ago", "2d ago".
 */
export function timeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
