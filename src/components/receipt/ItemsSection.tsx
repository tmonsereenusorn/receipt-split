"use client";

import { useState, useRef, useCallback } from "react";
import { ReceiptItem, Person } from "@/types";
import { Section } from "./Section";
import { ItemRow } from "./ItemRow";

interface ItemsSectionProps {
  items: ReceiptItem[];
  people: Person[];
  activePerson: string | null;
  unassignedCount: number;
  expandedId: string | null;
  currency: string;
  onToggleExpand: (id: string) => void;
  onUpdate: (id: string, updates: Partial<Omit<ReceiptItem, "id">>) => void;
  onDelete: (id: string) => void;
  onToggleAssignment: (itemId: string, personId: string) => void;
  onAddItem: () => void;
  onReorder: (itemId: string, newIndex: number) => void;
}

export function ItemsSection({
  items,
  people,
  activePerson,
  unassignedCount,
  expandedId,
  currency,
  onToggleExpand,
  onUpdate,
  onDelete,
  onToggleAssignment,
  onAddItem,
  onReorder,
}: ItemsSectionProps) {

  // Drag reorder state
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [insertBeforeId, setInsertBeforeId] = useState<string | null>(null);
  const itemRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  const handleDragStart = useCallback((itemId: string) => {
    setDraggingId(itemId);
    if (expandedId) onToggleExpand(expandedId);
  }, [expandedId, onToggleExpand]);

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!draggingId) return;
      const y = e.clientY;

      // Find which item the pointer is over
      let targetId: string | null = null;
      for (const item of items) {
        const el = itemRefs.current.get(item.id);
        if (!el) continue;
        const rect = el.getBoundingClientRect();
        if (y < rect.top + rect.height / 2) {
          targetId = item.id;
          break;
        }
      }
      setInsertBeforeId(targetId);
    },
    [draggingId, items]
  );

  const handlePointerUp = useCallback(() => {
    if (!draggingId) return;

    // Calculate new index
    let newIndex = items.length; // default: end
    if (insertBeforeId) {
      newIndex = items.findIndex((i) => i.id === insertBeforeId);
    }

    const oldIndex = items.findIndex((i) => i.id === draggingId);
    if (oldIndex !== -1 && newIndex !== oldIndex) {
      // Adjust index if moving down (since the item is removed first)
      if (newIndex > oldIndex) newIndex--;
      onReorder(draggingId, newIndex);
    }

    setDraggingId(null);
    setInsertBeforeId(null);
  }, [draggingId, insertBeforeId, items, onReorder]);

  const handlePointerCancel = useCallback(() => {
    setDraggingId(null);
    setInsertBeforeId(null);
  }, []);

  return (
    <Section>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="font-receipt text-base uppercase text-ink-muted">
          Items{" "}
          <span className="font-receipt text-base text-ink-faded">({items.length})</span>
          {unassignedCount > 0 && (
            <span className="font-receipt text-sm text-accent">
              {" "}· {unassignedCount} unassigned
            </span>
          )}
        </h3>
        <button
          type="button"
          onClick={onAddItem}
          className="font-receipt text-base text-ink-muted underline hover:text-ink"
        >
          + add
        </button>
      </div>

      {items.length === 0 ? (
        <p className="py-6 text-center font-receipt text-base text-ink-faded">
          no items yet
        </p>
      ) : (
        <div
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerCancel}
        >
          {items.map((item) => (
            <div
              key={item.id}
              ref={(el) => {
                if (el) itemRefs.current.set(item.id, el);
                else itemRefs.current.delete(item.id);
              }}
            >
              {/* Insertion line before this item */}
              {draggingId && insertBeforeId === item.id && (
                <div className="mx-2 h-0.5 bg-ink" />
              )}
              <ItemRow
                item={item}
                people={people}
                activePerson={activePerson}
                isExpanded={expandedId === item.id}
                isDragging={draggingId === item.id}
                currency={currency}
                onDragStart={handleDragStart}
                onToggleExpand={() => onToggleExpand(item.id)}
                onUpdate={onUpdate}
                onDelete={onDelete}
                onToggleAssignment={onToggleAssignment}
              />
            </div>
          ))}
          {/* Insertion line at the end */}
          {draggingId && insertBeforeId === null && (
            <div className="mx-2 h-0.5 bg-ink" />
          )}
        </div>
      )}
    </Section>
  );
}
