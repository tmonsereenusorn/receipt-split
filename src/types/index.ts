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

export interface TaxTip {
  /** Tax amount in cents */
  taxCents: number;
  /** Whether tax is expressed as a percentage */
  taxIsPercent: boolean;
  /** Tax percentage (used when taxIsPercent is true) */
  taxPercent: number;
  /** Tip amount in cents */
  tipCents: number;
  /** Whether tip is expressed as a percentage */
  tipIsPercent: boolean;
  /** Tip percentage (used when tipIsPercent is true) */
  tipPercent: number;
}

export const initialTaxTip: TaxTip = {
  taxCents: 0,
  taxIsPercent: true,
  taxPercent: 7,
  tipCents: 0,
  tipIsPercent: true,
  tipPercent: 20,
};

export interface ReceiptDoc {
  restaurantName: string | null;
  items: ReceiptItem[];
  people: Person[];
  taxTip: TaxTip;
  imageDataUrl: string | null;
  ocrText: string | null;
  createdAt: number;
}

export interface PersonBreakdown {
  person: Person;
  items: { item: ReceiptItem; shareCents: number; splitCount: number }[];
  subtotalCents: number;
  taxShareCents: number;
  tipShareCents: number;
  totalCents: number;
}
