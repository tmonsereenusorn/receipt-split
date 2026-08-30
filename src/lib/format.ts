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
/**
 * A summary made for pasting into a group chat.
 *
 * Deliberately just the totals: who owes what, and a link to the receipt for
 * anyone who wants the item-by-item breakdown. The long form belonged on the
 * page, not in everyone's messages.
 */
export function generateShareText(
  items: ReceiptItem[],
  charges: ReceiptCharge[],
  tip: Tip,
  breakdowns: PersonBreakdown[],
  currency: string,
  url: string,
  restaurantName: string | null
): string {
  const subtotal = getSubtotalCents(items);
  const tipCents = getEffectiveTipCents(tip, subtotal);
  const grandTotal = subtotal + getChargesTotalCents(charges) + tipCents;

  // Charges and tip are distributed across assigned items only, so with
  // anything unassigned the per-person lines sum to less than the total. Naming
  // the gap keeps that from reading as an arithmetic error.
  const split = breakdowns.reduce((sum, b) => sum + b.totalCents, 0);
  const unassigned = grandTotal - split;

  const lines: string[] = [
    restaurantName ? `Shplit · ${restaurantName}` : "Shplit",
    unassigned > 0
      ? `Total: ${formatMoney(grandTotal, currency)} · ${formatMoney(unassigned, currency)} unassigned`
      : `Total: ${formatMoney(grandTotal, currency)}`,
    "",
  ];

  for (const b of breakdowns) {
    // Someone on the receipt but assigned nothing is noise in a summary.
    if (b.totalCents === 0) continue;
    lines.push(`${b.person.name}: ${formatMoney(b.totalCents, currency)}`);
  }

  lines.push("", url);

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
