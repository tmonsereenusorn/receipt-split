"use client";

import { useState, useEffect, useCallback } from "react";
import {
  ReceiptDoc,
  ReceiptItem,
  ReceiptCharge,
  Tip,
} from "@/types";
import { normalizeReceiptMoney } from "@/lib/charges";
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
  fsAddCharge,
  fsUpdateCharge,
  fsDeleteCharge,
  fsSetTip,
  fsSetRestaurantName,
  fsSetCurrency,
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
  // Recomputed on every render rather than stored, so a legacy document is
  // converted on each read and no consumer can see the pre-charges shape.
  const { charges, tip } = normalizeReceiptMoney(data, items);
  const imageDataUrl = data?.imageDataUrl ?? null;
  const ocrText = data?.ocrText ?? null;
  const restaurantName = data?.restaurantName ?? null;
  const currency = data?.currency ?? "USD";

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

  const addCharge = useCallback(
    (label: string, amountCents: number) => {
      const charge: ReceiptCharge = {
        id: `charge-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        label,
        amountCents,
      };
      setData(prev => {
        if (!prev) return prev;
        // Build from the normalized shape, not prev.charges: on a legacy
        // document prev.charges is undefined, and writing a bare array would
        // send the next read down the new-shape branch, discarding the migrated
        // charges instead of merging with them. Mirrors the transaction side.
        const { charges, tip } = normalizeReceiptMoney(prev, prev.items ?? []);
        return { ...prev, charges: [...charges, charge], tip };
      });
      fsAddCharge(receiptId, charge);
    },
    [receiptId]
  );

  const updateCharge = useCallback(
    (chargeId: string, updates: Partial<Omit<ReceiptCharge, "id">>) => {
      setData(prev => {
        if (!prev) return prev;
        const { charges, tip } = normalizeReceiptMoney(prev, prev.items ?? []);
        return {
          ...prev,
          charges: charges.map(c => (c.id === chargeId ? { ...c, ...updates } : c)),
          tip,
        };
      });
      fsUpdateCharge(receiptId, chargeId, updates);
    },
    [receiptId]
  );

  const deleteCharge = useCallback(
    (chargeId: string) => {
      setData(prev => {
        if (!prev) return prev;
        const { charges, tip } = normalizeReceiptMoney(prev, prev.items ?? []);
        return { ...prev, charges: charges.filter(c => c.id !== chargeId), tip };
      });
      fsDeleteCharge(receiptId, chargeId);
    },
    [receiptId]
  );

  const setTip = useCallback(
    (updates: Partial<Tip>) => {
      setData(prev => {
        if (!prev) return prev;
        // charges must be written too: without it a legacy document still has no
        // charges key, so the next normalize takes the taxTip branch and throws
        // this tip away.
        const { charges, tip } = normalizeReceiptMoney(prev, prev.items ?? []);
        return { ...prev, charges, tip: { ...tip, ...updates } };
      });
      fsSetTip(receiptId, updates);
    },
    [receiptId]
  );


  const setCurrency = useCallback(
    (currency: string) => {
      setData(prev => prev ? { ...prev, currency } : prev);
      fsSetCurrency(receiptId, currency);
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
    charges,
    tip,
    imageDataUrl,
    ocrText,
    restaurantName,
    currency,
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
    addCharge,
    updateCharge,
    deleteCharge,
    setTip,
    setCurrency,
    setRestaurantName,
    setOcrText,
  };
}
