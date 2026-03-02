"use client";

import {
  createContext,
  useReducer,
  useEffect,
  useRef,
  type ReactNode,
} from "react";
import { ReceiptState, ReceiptAction, TaxTip } from "@/types";

const STORAGE_KEY = "receipt-split-state";

const initialTaxTip: TaxTip = {
  taxCents: 0,
  taxIsPercent: false,
  taxPercent: 0,
  tipCents: 0,
  tipIsPercent: true,
  tipPercent: 20,
};

const initialState: ReceiptState = {
  items: [],
  people: [],
  taxTip: initialTaxTip,
  imageDataUrl: null,
  ocrText: null,
  restaurantName: null,
};

function receiptReducer(
  state: ReceiptState,
  action: ReceiptAction
): ReceiptState {
  switch (action.type) {
    case "SET_ITEMS":
      return { ...state, items: action.items };

    case "ADD_ITEM":
      return { ...state, items: [...state.items, action.item] };

    case "UPDATE_ITEM":
      return {
        ...state,
        items: state.items.map((item) =>
          item.id === action.id ? { ...item, ...action.updates } : item
        ),
      };

    case "DELETE_ITEM":
      return {
        ...state,
        items: state.items.filter((item) => item.id !== action.id),
      };

    case "ADD_PERSON":
      return { ...state, people: [...state.people, action.person] };

    case "UPDATE_PERSON":
      return {
        ...state,
        people: state.people.map((p) =>
          p.id === action.id ? { ...p, name: action.name } : p
        ),
      };

    case "DELETE_PERSON": {
      return {
        ...state,
        people: state.people.filter((p) => p.id !== action.id),
        items: state.items.map((item) => ({
          ...item,
          assignedTo: item.assignedTo.filter((id) => id !== action.id),
        })),
      };
    }

    case "TOGGLE_ASSIGNMENT": {
      return {
        ...state,
        items: state.items.map((item) => {
          if (item.id !== action.itemId) return item;
          const has = item.assignedTo.includes(action.personId);
          return {
            ...item,
            assignedTo: has
              ? item.assignedTo.filter((id) => id !== action.personId)
              : [...item.assignedTo, action.personId],
          };
        }),
      };
    }

    case "MOVE_ITEM": {
      const items = [...state.items];
      const idx = items.findIndex((i) => i.id === action.id);
      if (idx === -1) return state;
      const swap = action.direction === "up" ? idx - 1 : idx + 1;
      if (swap < 0 || swap >= items.length) return state;
      [items[idx], items[swap]] = [items[swap], items[idx]];
      return { ...state, items };
    }

    case "SET_TAX_TIP":
      return {
        ...state,
        taxTip: { ...state.taxTip, ...action.taxTip },
      };

    case "SET_IMAGE":
      return { ...state, imageDataUrl: action.dataUrl };

    case "SET_OCR_TEXT":
      return { ...state, ocrText: action.text };

    case "SET_RESTAURANT_NAME":
      return { ...state, restaurantName: action.name };

    case "RESET":
      return initialState;

    default:
      return state;
  }
}

export const ReceiptContext = createContext<{
  state: ReceiptState;
  dispatch: React.Dispatch<ReceiptAction>;
}>({
  state: initialState,
  dispatch: () => undefined,
});

function loadState(): ReceiptState {
  if (typeof window === "undefined") return initialState;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return { ...initialState, ...parsed };
    }
  } catch {
    // ignore
  }
  return initialState;
}

export function ReceiptProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(receiptReducer, initialState, loadState);
  const isInitialized = useRef(false);

  useEffect(() => {
    // Skip first render (the init from loadState already ran)
    if (!isInitialized.current) {
      isInitialized.current = true;
      return;
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // storage full or unavailable
    }
  }, [state]);

  return (
    <ReceiptContext.Provider value={{ state, dispatch }}>
      {children}
    </ReceiptContext.Provider>
  );
}
