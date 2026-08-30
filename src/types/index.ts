export interface ReceiptItem {
  id: string;
  name: string;
  quantity: number;
  /** Price per unit in cents */
  priceCents: number;
  assignedTo: string[];
}

export interface Person {
  id: string;
  name: string;
  color: string;
}

/**
 * A non-item line that changes the receipt total: tax, service charge, delivery
 * fee, bag fee, surcharge — or a discount, promo, or comp, stored as a negative
 * amount.
 *
 * Deliberately generic. Fee wording varies by venue, region, and language, so
 * the category lives in the parsed label rather than in the type — adding a new
 * kind of fee is data, not code.
 */
export interface ReceiptCharge {
  id: string;
  /** Label as printed on the receipt, e.g. "Tax", "Service Charge", "Bag Fee" */
  label: string;
  /** Amount in cents. Charges are always cash — no percent mode. */
  amountCents: number;
}

/**
 * The tip is the one line a diner adds after the receipt prints, so unlike a
 * charge it keeps percent mode and a suggested default.
 */
export interface Tip {
  /** Tip amount in cents (used when isPercent is false) */
  cents: number;
  /** Whether the tip is expressed as a percentage */
  isPercent: boolean;
  /** Tip percentage (used when isPercent is true) */
  percent: number;
}

export const initialTip: Tip = {
  cents: 0,
  isPercent: true,
  percent: 20,
};

export interface ReceiptDoc {
  restaurantName: string | null;
  currency: string;
  items: ReceiptItem[];
  people: Person[];
  charges: ReceiptCharge[];
  tip: Tip;
  imageDataUrl: string | null;
  ocrText: string | null;
  createdAt: number;
}

export interface PersonBreakdown {
  person: Person;
  items: { item: ReceiptItem; shareCents: number; splitCount: number }[];
  subtotalCents: number;
  /** One entry per receipt charge, in receipt order */
  chargeShares: { chargeId: string; label: string; shareCents: number }[];
  tipShareCents: number;
  totalCents: number;
}
