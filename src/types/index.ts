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

export interface ReceiptState {
  items: ReceiptItem[];
  people: Person[];
  taxTip: TaxTip;
  imageDataUrl: string | null;
  ocrText: string | null;
  restaurantName: string | null;
}

export type ReceiptAction =
  | { type: "SET_ITEMS"; items: ReceiptItem[] }
  | { type: "ADD_ITEM"; item: ReceiptItem }
  | { type: "UPDATE_ITEM"; id: string; updates: Partial<Omit<ReceiptItem, "id">> }
  | { type: "DELETE_ITEM"; id: string }
  | { type: "ADD_PERSON"; person: Person }
  | { type: "UPDATE_PERSON"; id: string; name: string }
  | { type: "DELETE_PERSON"; id: string }
  | { type: "TOGGLE_ASSIGNMENT"; itemId: string; personId: string }
  | { type: "MOVE_ITEM"; id: string; direction: "up" | "down" }
  | { type: "SET_TAX_TIP"; taxTip: Partial<TaxTip> }
  | { type: "SET_IMAGE"; dataUrl: string }
  | { type: "SET_OCR_TEXT"; text: string }
  | { type: "SET_RESTAURANT_NAME"; name: string | null }
  | { type: "RESET" };

export interface PersonBreakdown {
  person: Person;
  items: { item: ReceiptItem; shareCents: number; splitCount: number }[];
  subtotalCents: number;
  taxShareCents: number;
  tipShareCents: number;
  totalCents: number;
}
