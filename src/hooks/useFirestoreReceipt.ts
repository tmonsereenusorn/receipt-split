"use client";

import { useState, useEffect, useCallback } from "react";
import {
  ReceiptDoc,
  ReceiptItem,
  Person,
  TaxTip,
  initialTaxTip,
} from "@/types";
import {
  subscribeToReceipt,
  fsSetItems,
  fsAddItem,
  fsUpdateItem,
  fsDeleteItem,
  fsMoveItem,
  fsAddPerson,
  fsUpdatePerson,
  fsDeletePerson,
  fsToggleAssignment,
  fsSetTaxTip,
  fsSetRestaurantName,
  fsSetImage,
  fsSetOcrText,
} from "@/lib/firestore";

const COLORS = [
  "#22d3ee", "#a78bfa", "#fb7185", "#34d399",
  "#fb923c", "#38bdf8", "#e879f9", "#a3e635",
];

export function useFirestoreReceipt(receiptId: string) {
  const [data, setData] = useState<ReceiptDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);

    const unsubscribe = subscribeToReceipt(
      receiptId,
      (doc) => {
        setData(doc);
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [receiptId]);

  const items = data?.items ?? [];
  const people = data?.people ?? [];
  const taxTip = data?.taxTip ?? initialTaxTip;
  const imageDataUrl = data?.imageDataUrl ?? null;
  const ocrText = data?.ocrText ?? null;
  const restaurantName = data?.restaurantName ?? null;

  const setItems = useCallback(
    (newItems: ReceiptItem[]) => { fsSetItems(receiptId, newItems); },
    [receiptId]
  );

  const addItem = useCallback(
    (name: string, quantity: number, priceCents: number) => {
      fsAddItem(receiptId, {
        id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        name,
        quantity,
        priceCents,
        assignedTo: [],
      });
    },
    [receiptId]
  );

  const updateItem = useCallback(
    (id: string, updates: Partial<Omit<ReceiptItem, "id">>) => {
      fsUpdateItem(receiptId, id, updates);
    },
    [receiptId]
  );

  const deleteItem = useCallback(
    (id: string) => { fsDeleteItem(receiptId, id); },
    [receiptId]
  );

  const moveItem = useCallback(
    (id: string, direction: "up" | "down") => {
      fsMoveItem(receiptId, id, direction);
    },
    [receiptId]
  );

  const addPerson = useCallback(
    (name: string) => {
      const color = COLORS[people.length % COLORS.length];
      fsAddPerson(receiptId, {
        id: `person-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        name,
        color,
      });
    },
    [receiptId, people.length]
  );

  const updatePerson = useCallback(
    (id: string, name: string) => { fsUpdatePerson(receiptId, id, name); },
    [receiptId]
  );

  const deletePerson = useCallback(
    (id: string) => { fsDeletePerson(receiptId, id); },
    [receiptId]
  );

  const toggleAssignment = useCallback(
    (itemId: string, personId: string) => {
      fsToggleAssignment(receiptId, itemId, personId);
    },
    [receiptId]
  );

  const setTaxTip = useCallback(
    (updates: Partial<TaxTip>) => { fsSetTaxTip(receiptId, updates); },
    [receiptId]
  );

  const setRestaurantName = useCallback(
    (name: string | null) => { fsSetRestaurantName(receiptId, name); },
    [receiptId]
  );

  const setImage = useCallback(
    (dataUrl: string) => { fsSetImage(receiptId, dataUrl); },
    [receiptId]
  );

  const setOcrText = useCallback(
    (text: string) => { fsSetOcrText(receiptId, text); },
    [receiptId]
  );

  return {
    items,
    people,
    taxTip,
    imageDataUrl,
    ocrText,
    restaurantName,
    loading,
    error,
    setItems,
    addItem,
    updateItem,
    deleteItem,
    moveItem,
    addPerson,
    updatePerson,
    deletePerson,
    toggleAssignment,
    setTaxTip,
    setRestaurantName,
    setImage,
    setOcrText,
  };
}
