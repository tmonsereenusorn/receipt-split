"use client";

import { useState, useEffect, useCallback } from "react";
import {
  ReceiptDoc,
  ReceiptItem,
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
  fsReorderItem,
  fsAddPerson,
  fsUpdatePerson,
  fsDeletePerson,
  fsToggleAssignment,
  fsSetTaxTip,
  fsSetRestaurantName,
  fsSetOcrText,
} from "@/lib/firestore";

import { PERSON_COLORS } from "@/lib/constants";

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
    (newItems: ReceiptItem[]) => {
      setData(prev => prev ? { ...prev, items: newItems } : prev);
      fsSetItems(receiptId, newItems);
    },
    [receiptId]
  );

  const addItem = useCallback(
    (name: string, quantity: number, priceCents: number) => {
      const item: ReceiptItem = {
        id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        name,
        quantity,
        priceCents,
        assignedTo: [],
      };
      setData(prev => prev ? { ...prev, items: [item, ...prev.items] } : prev);
      fsAddItem(receiptId, item);
    },
    [receiptId]
  );

  const updateItem = useCallback(
    (id: string, updates: Partial<Omit<ReceiptItem, "id">>) => {
      setData(prev => prev ? { ...prev, items: prev.items.map(item => item.id === id ? { ...item, ...updates } : item) } : prev);
      fsUpdateItem(receiptId, id, updates);
    },
    [receiptId]
  );

  const deleteItem = useCallback(
    (id: string) => {
      setData(prev => prev ? { ...prev, items: prev.items.filter(item => item.id !== id) } : prev);
      fsDeleteItem(receiptId, id);
    },
    [receiptId]
  );

  const moveItem = useCallback(
    (id: string, direction: "up" | "down") => {
      setData(prev => {
        if (!prev) return prev;
        const items = [...prev.items];
        const idx = items.findIndex(i => i.id === id);
        if (idx === -1) return prev;
        const swap = direction === "up" ? idx - 1 : idx + 1;
        if (swap < 0 || swap >= items.length) return prev;
        [items[idx], items[swap]] = [items[swap], items[idx]];
        return { ...prev, items };
      });
      fsMoveItem(receiptId, id, direction);
    },
    [receiptId]
  );

  const reorderItem = useCallback(
    (itemId: string, newIndex: number) => {
      setData(prev => {
        if (!prev) return prev;
        const items = [...prev.items];
        const oldIndex = items.findIndex(i => i.id === itemId);
        if (oldIndex === -1) return prev;
        const [item] = items.splice(oldIndex, 1);
        items.splice(newIndex, 0, item);
        return { ...prev, items };
      });
      fsReorderItem(receiptId, itemId, newIndex);
    },
    [receiptId]
  );

  const addPerson = useCallback(
    (name: string) => {
      const color = PERSON_COLORS[people.length % PERSON_COLORS.length];
      const person = {
        id: `person-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        name,
        color,
      };
      setData(prev => prev ? { ...prev, people: [...prev.people, person] } : prev);
      fsAddPerson(receiptId, person);
    },
    [receiptId, people.length]
  );

  const updatePerson = useCallback(
    (id: string, name: string) => {
      setData(prev => prev ? { ...prev, people: prev.people.map(p => p.id === id ? { ...p, name } : p) } : prev);
      fsUpdatePerson(receiptId, id, name);
    },
    [receiptId]
  );

  const deletePerson = useCallback(
    (id: string) => {
      setData(prev => prev ? {
        ...prev,
        people: prev.people.filter(p => p.id !== id),
        items: prev.items.map(item => ({
          ...item,
          assignedTo: item.assignedTo.filter(pid => pid !== id),
        })),
      } : prev);
      fsDeletePerson(receiptId, id);
    },
    [receiptId]
  );

  const toggleAssignment = useCallback(
    (itemId: string, personId: string) => {
      setData(prev => prev ? {
        ...prev,
        items: prev.items.map(item => {
          if (item.id !== itemId) return item;
          const has = item.assignedTo.includes(personId);
          return {
            ...item,
            assignedTo: has
              ? item.assignedTo.filter(pid => pid !== personId)
              : [...item.assignedTo, personId],
          };
        }),
      } : prev);
      fsToggleAssignment(receiptId, itemId, personId);
    },
    [receiptId]
  );

  const setTaxTip = useCallback(
    (updates: Partial<TaxTip>) => {
      setData(prev => prev ? { ...prev, taxTip: { ...prev.taxTip, ...updates } } : prev);
      fsSetTaxTip(receiptId, updates);
    },
    [receiptId]
  );

  const setRestaurantName = useCallback(
    (name: string | null) => {
      setData(prev => prev ? { ...prev, restaurantName: name } : prev);
      fsSetRestaurantName(receiptId, name);
    },
    [receiptId]
  );

  const setOcrText = useCallback(
    (text: string) => {
      setData(prev => prev ? { ...prev, ocrText: text } : prev);
      fsSetOcrText(receiptId, text);
    },
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
    reorderItem,
    addPerson,
    updatePerson,
    deletePerson,
    toggleAssignment,
    setTaxTip,
    setRestaurantName,
    setOcrText,
  };
}
