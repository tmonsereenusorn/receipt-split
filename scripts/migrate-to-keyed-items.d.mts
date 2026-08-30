/**
 * Types for the migration script, so its pure conversion functions can be
 * imported by tests without `any` leaking through.
 */
export interface LegacyItem {
  id?: unknown;
  name?: unknown;
  quantity?: unknown;
  priceCents?: unknown;
  assignedTo?: unknown;
}

export interface KeyedItems {
  items: Record<string, { name: string; quantity: number; priceCents: number }>;
  itemOrder: string[];
  assignments: Record<string, string[]>;
  /** Items with no usable id. Non-empty means the caller must refuse to write. */
  dropped: unknown[];
}

export interface MigratedMoney {
  charges: { id: string; label: string; amountCents: number }[];
  tip: { cents: number; isPercent: boolean; percent: number };
}

export function keyItems(items: LegacyItem[]): KeyedItems;

export function moneyFromTaxTip(
  taxTip: Record<string, unknown> | undefined | null,
  items: LegacyItem[]
): MigratedMoney | null;

export function main(): Promise<void>;
