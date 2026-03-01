"use client";

import { useState, useRef } from "react";
import { ReceiptItem, Person } from "@/types";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ItemRow } from "./ItemRow";

interface ItemTableProps {
  items: ReceiptItem[];
  people: Person[];
  onUpdate: (id: string, updates: Partial<Omit<ReceiptItem, "id">>) => void;
  onDelete: (id: string) => void;
  onToggleAssignment: (itemId: string, personId: string) => void;
  onReorder: (items: ReceiptItem[]) => void;
  onAddItem: () => void;
}

export function ItemTable({
  items,
  people,
  onUpdate,
  onDelete,
  onToggleAssignment,
  onReorder,
  onAddItem,
}: ItemTableProps) {
  const dragItemId = useRef<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  function handleDragStart(e: React.DragEvent, id: string) {
    dragItemId.current = id;
    e.dataTransfer.effectAllowed = "move";
  }

  function handleDragOver(e: React.DragEvent, overId: string) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragItemId.current && dragItemId.current !== overId) {
      setDragOverId(overId);
    }
  }

  function handleDragEnd() {
    if (dragItemId.current && dragOverId) {
      const fromIdx = items.findIndex((i) => i.id === dragItemId.current);
      const toIdx = items.findIndex((i) => i.id === dragOverId);
      if (fromIdx !== -1 && toIdx !== -1 && fromIdx !== toIdx) {
        const reordered = [...items];
        const [moved] = reordered.splice(fromIdx, 1);
        reordered.splice(toIdx, 0, moved);
        onReorder(reordered);
      }
    }
    dragItemId.current = null;
    setDragOverId(null);
  }

  return (
    <Card>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700">
          Items ({items.length})
        </h3>
        <Button variant="ghost" size="sm" onClick={onAddItem}>
          + Add Item
        </Button>
      </div>
      {items.length === 0 ? (
        <p className="py-6 text-center text-sm text-gray-400">
          No items yet. Add items manually or scan a receipt.
        </p>
      ) : (
        <div>
          {items.map((item) => (
            <ItemRow
              key={item.id}
              item={item}
              people={people}
              isDragOver={dragOverId === item.id}
              onUpdate={onUpdate}
              onDelete={onDelete}
              onToggleAssignment={onToggleAssignment}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDragEnd={handleDragEnd}
            />
          ))}
        </div>
      )}
    </Card>
  );
}
