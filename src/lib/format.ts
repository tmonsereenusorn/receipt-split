import { PersonBreakdown, ReceiptCharge, ReceiptItem, Tip } from "@/types";
import {
  getChargesTotalCents,
  getEffectiveTipCents,
  getSubtotalCents,
} from "./calculator";
import { formatMoney, formatMoneyRaw } from "./currency";

/**
 * Generate a shareable text summary of the receipt split.
 */
export function generateShareText(
  items: ReceiptItem[],
  charges: ReceiptCharge[],
  tip: Tip,
  breakdowns: PersonBreakdown[],
  currency: string
): string {
  const subtotal = getSubtotalCents(items);
  const tipCents = getEffectiveTipCents(tip, subtotal);
  const chargesTotal = getChargesTotalCents(charges);
  const grandTotal = subtotal + chargesTotal + tipCents;

  const lines: string[] = [
    "Shplit",
    "─".repeat(30),
    `Subtotal: ${formatMoney(subtotal, currency)}`,
    ...charges
      .filter((c) => c.amountCents !== 0)
      .map((c) => `${c.label}: ${formatMoney(c.amountCents, currency)}`),
    `Tip: ${formatMoney(tipCents, currency)}`,
    `Total: ${formatMoney(grandTotal, currency)}`,
    "",
    "Per Person:",
    "─".repeat(30),
  ];

  for (const b of breakdowns) {
    lines.push(`${b.person.name}: ${formatMoney(b.totalCents, currency)}`);
    for (const pi of b.items) {
      const splitNote =
        pi.splitCount > 1 ? ` (1/${pi.splitCount})` : "";
      lines.push(`  • ${pi.item.name}${splitNote}: ${formatMoney(pi.shareCents, currency)}`);
    }
    for (const share of b.chargeShares) {
      // !== 0 rather than > 0: a discount is a negative charge and must show.
      if (share.shareCents !== 0) {
        lines.push(`  • ${share.label}: ${formatMoney(share.shareCents, currency)}`);
      }
    }
    if (b.tipShareCents > 0) {
      lines.push(`  • Tip: ${formatMoney(b.tipShareCents, currency)}`);
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
  charges: ReceiptCharge[],
  tip: Tip,
  breakdowns: PersonBreakdown[],
  currency: string
): string {
  const subtotal = getSubtotalCents(items);
  const tipCents = getEffectiveTipCents(tip, subtotal);
  const chargesTotal = getChargesTotalCents(charges);

  const rows: string[][] = [];

  // Header
  const personNames = breakdowns.map((b) => b.person.name);
  rows.push(["Item", "Qty", "Price", "Total", ...personNames]);

  // Item rows
  for (const item of items) {
    const row = [
      `"${item.name.replace(/"/g, '""')}"`,
      String(item.quantity),
      formatMoneyRaw(item.priceCents, currency),
      formatMoneyRaw(item.quantity * item.priceCents, currency),
    ];
    for (const b of breakdowns) {
      const pi = b.items.find((i) => i.item.id === item.id);
      row.push(pi ? formatMoneyRaw(pi.shareCents, currency) : "");
    }
    rows.push(row);
  }

  // Subtotal row
  rows.push(["Subtotal", "", "", formatMoneyRaw(subtotal, currency), ...breakdowns.map((b) => formatMoneyRaw(b.subtotalCents, currency))]);
  // Tax row
  for (const charge of charges) {
    if (charge.amountCents === 0) continue;
    rows.push([
      `"${charge.label.replace(/"/g, '""')}"`,
      "",
      "",
      formatMoneyRaw(charge.amountCents, currency),
      // Matched by id, not array position: chargeShares carries chargeId for
      // exactly this, and a positional lookup would silently zero a mismatch.
      ...breakdowns.map((b) =>
        formatMoneyRaw(
          b.chargeShares.find((s) => s.chargeId === charge.id)?.shareCents ?? 0,
          currency
        )
      ),
    ]);
  }
  // Tip row
  rows.push(["Tip", "", "", formatMoneyRaw(tipCents, currency), ...breakdowns.map((b) => formatMoneyRaw(b.tipShareCents, currency))]);
  // Total row
  const grandTotal = subtotal + chargesTotal + tipCents;
  rows.push(["Total", "", "", formatMoneyRaw(grandTotal, currency), ...breakdowns.map((b) => formatMoneyRaw(b.totalCents, currency))]);

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
