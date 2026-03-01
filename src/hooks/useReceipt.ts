"use client";

import { useContext } from "react";
import { ReceiptContext } from "@/context/ReceiptContext";
import { ReceiptItem, Person, TaxTip } from "@/types";

const COLORS = [
  "#22d3ee", // cyan-400
  "#a78bfa", // violet-400
  "#fb7185", // rose-400
  "#34d399", // emerald-400
  "#fb923c", // orange-400
  "#38bdf8", // sky-400
  "#e879f9", // fuchsia-400
  "#a3e635", // lime-400
];

export function useReceipt() {
  const { state, dispatch } = useContext(ReceiptContext);

  return {
    ...state,

    setItems(items: ReceiptItem[]) {
      dispatch({ type: "SET_ITEMS", items });
    },

    addItem(name: string, quantity: number, priceCents: number) {
      dispatch({
        type: "ADD_ITEM",
        item: {
          id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          name,
          quantity,
          priceCents,
          assignedTo: [],
        },
      });
    },

    updateItem(id: string, updates: Partial<Omit<ReceiptItem, "id">>) {
      dispatch({ type: "UPDATE_ITEM", id, updates });
    },

    deleteItem(id: string) {
      dispatch({ type: "DELETE_ITEM", id });
    },

    moveItem(id: string, direction: "up" | "down") {
      dispatch({ type: "MOVE_ITEM", id, direction });
    },

    addPerson(name: string) {
      const color = COLORS[state.people.length % COLORS.length];
      dispatch({
        type: "ADD_PERSON",
        person: {
          id: `person-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          name,
          color,
        },
      });
    },

    updatePerson(id: string, name: string) {
      dispatch({ type: "UPDATE_PERSON", id, name });
    },

    deletePerson(id: string) {
      dispatch({ type: "DELETE_PERSON", id });
    },

    toggleAssignment(itemId: string, personId: string) {
      dispatch({ type: "TOGGLE_ASSIGNMENT", itemId, personId });
    },

    setTaxTip(taxTip: Partial<TaxTip>) {
      dispatch({ type: "SET_TAX_TIP", taxTip });
    },

    setImage(dataUrl: string) {
      dispatch({ type: "SET_IMAGE", dataUrl });
    },

    setOcrText(text: string) {
      dispatch({ type: "SET_OCR_TEXT", text });
    },

    reset() {
      dispatch({ type: "RESET" });
    },
  };
}
