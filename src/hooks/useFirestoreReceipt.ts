"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
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
  fsSetItemOrder,
  fsAddPerson,
  fsUpdatePerson,
  fsDeletePerson,
  fsSetAssignment,
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

  /**
   * Dispatch a write.
   *
   * There is no optimistic update here on purpose. `updateDoc` is applied to
   * Firestore's local cache the instant it is issued and the listener fires
   * immediately, so a second optimistic layer would only race the first — which
   * is the bug this replaced. Failures surface rather than being dropped: the
   * cache has already applied the change, so a permanent failure would
   * otherwise leave the UI silently disagreeing with the server.
   */
  const dispatch = useCallback((write: Promise<void>, whatFailed: string) => {
    write.catch(() => setError(`Couldn't ${whatFailed}. Check your connection.`));
  }, []);

  // Memoised because these feed useCallback dependency arrays. Without a stable
  // identity the fallback allocates a new array every render, so every callback
  // is recreated every render — churn, not staleness, since each is already in
  // its dependency list.
  const items = useMemo(() => data?.items ?? [], [data?.items]);
  const people = useMemo(() => data?.people ?? [], [data?.people]);
  const { charges, tip } = useMemo(() => normalizeReceiptMoney(data), [data]);
  const imageDataUrl = data?.imageDataUrl ?? null;
  const ocrText = data?.ocrText ?? null;
  const restaurantName = data?.restaurantName ?? null;
  const currency = data?.currency ?? "USD";

  const setItems = useCallback(
    (newItems: ReceiptItem[]) => {
      dispatch(fsSetItems(receiptId, newItems), "save the items");
    },
    [receiptId, dispatch]
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
      dispatch(
        fsAddItem(receiptId, item, items.map((i) => i.id)),
        "add that item"
      );
    },
    [receiptId, items, dispatch]
  );

  const updateItem = useCallback(
    (id: string, updates: Partial<Omit<ReceiptItem, "id">>) => {
      dispatch(fsUpdateItem(receiptId, id, updates), "save that change");
    },
    [receiptId, dispatch]
  );

  const deleteItem = useCallback(
    (id: string) => {
      dispatch(fsDeleteItem(receiptId, id), "delete that item");
    },
    [receiptId, dispatch]
  );

  const moveItem = useCallback(
    (id: string, direction: "up" | "down") => {
      const order = items.map((i) => i.id);
      const idx = order.indexOf(id);
      const swap = direction === "up" ? idx - 1 : idx + 1;
      if (idx === -1 || swap < 0 || swap >= order.length) return;
      [order[idx], order[swap]] = [order[swap], order[idx]];
      dispatch(fsSetItemOrder(receiptId, order), "reorder the items");
    },
    [receiptId, items, dispatch]
  );

  const reorderItem = useCallback(
    (itemId: string, newIndex: number) => {
      const order = items.map((i) => i.id);
      const oldIndex = order.indexOf(itemId);
      if (oldIndex === -1) return;
      order.splice(newIndex, 0, ...order.splice(oldIndex, 1));
      dispatch(fsSetItemOrder(receiptId, order), "reorder the items");
    },
    [receiptId, items, dispatch]
  );

  const addPerson = useCallback(
    (name: string) => {
      const color = PERSON_COLORS[people.length % PERSON_COLORS.length];
      const person = {
        id: `person-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        name,
        color,
      };
      dispatch(fsAddPerson(receiptId, person), "add that person");
    },
    [receiptId, people.length, dispatch]
  );

  const updatePerson = useCallback(
    (id: string, name: string) => {
      dispatch(fsUpdatePerson(receiptId, id, name), "rename that person");
    },
    [receiptId, dispatch]
  );

  const deletePerson = useCallback(
    (id: string) => {
      dispatch(fsDeletePerson(receiptId, id), "remove that person");
    },
    [receiptId, dispatch]
  );

  const toggleAssignment = useCallback(
    (itemId: string, personId: string) => {
      // The UI asks to flip, but the write states the intended result, so a
      // duplicate click is a no-op rather than a reversal.
      const item = items.find((i) => i.id === itemId);
      if (!item) return;
      const assigned = !item.assignedTo.includes(personId);
      dispatch(
        fsSetAssignment(receiptId, itemId, personId, assigned),
        "update that assignment"
      );
    },
    [receiptId, items, dispatch]
  );

  const addCharge = useCallback(
    (label: string, amountCents: number) => {
      const charge: ReceiptCharge = {
        id: `charge-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        label,
        amountCents,
      };
      dispatch(fsAddCharge(receiptId, charge), "add that charge");
    },
    [receiptId, dispatch]
  );

  const updateCharge = useCallback(
    (chargeId: string, updates: Partial<Omit<ReceiptCharge, "id">>) => {
      dispatch(fsUpdateCharge(receiptId, chargeId, updates), "save that charge");
    },
    [receiptId, dispatch]
  );

  const deleteCharge = useCallback(
    (chargeId: string) => {
      dispatch(fsDeleteCharge(receiptId, chargeId), "delete that charge");
    },
    [receiptId, dispatch]
  );

  const setTip = useCallback(
    (updates: Partial<Tip>) => {
      dispatch(fsSetTip(receiptId, updates), "update the tip");
    },
    [receiptId, dispatch]
  );

  const setCurrency = useCallback(
    (currency: string) => {
      dispatch(fsSetCurrency(receiptId, currency), "change the currency");
    },
    [receiptId, dispatch]
  );


  const setRestaurantName = useCallback(
    (name: string | null) => {
      dispatch(fsSetRestaurantName(receiptId, name), "rename the receipt");
    },
    [receiptId, dispatch]
  );


  const setOcrText = useCallback(
    (text: string) => {
      dispatch(fsSetOcrText(receiptId, text), "save the scan text");
    },
    [receiptId, dispatch]
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
