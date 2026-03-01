"use client";

import { ReceiptItem, Person } from "@/types";
import { formatCents } from "@/lib/format";
import { CurrencyInput } from "@/components/ui/CurrencyInput";
import { PersonChip } from "./PersonChip";

interface ItemRowProps {
  item: ReceiptItem;
  people: Person[];
  isDragOver: boolean;
  onUpdate: (id: string, updates: Partial<Omit<ReceiptItem, "id">>) => void;
  onDelete: (id: string) => void;
  onToggleAssignment: (itemId: string, personId: string) => void;
  onDragStart: (e: React.DragEvent, id: string) => void;
  onDragOver: (e: React.DragEvent, id: string) => void;
  onDragEnd: () => void;
}

export function ItemRow({
  item,
  people,
  isDragOver,
  onUpdate,
  onDelete,
  onToggleAssignment,
  onDragStart,
  onDragOver,
  onDragEnd,
}: ItemRowProps) {
  return (
    <div
      className={`flex flex-col gap-2 border-b border-gray-100 py-3 last:border-0 transition-colors ${
        isDragOver ? "bg-blue-50 border-blue-200" : ""
      }`}
      onDragOver={(e) => onDragOver(e, item.id)}
      onDrop={(e) => e.preventDefault()}
    >
      <div className="flex items-start gap-2">
        <div
          draggable
          onDragStart={(e) => onDragStart(e, item.id)}
          onDragEnd={onDragEnd}
          className="cursor-grab active:cursor-grabbing pt-1 px-0.5 text-gray-300 hover:text-gray-500 touch-none"
          aria-label={`Drag to reorder ${item.name}`}
          role="button"
          tabIndex={0}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="9" cy="5" r="1.5" />
            <circle cx="15" cy="5" r="1.5" />
            <circle cx="9" cy="12" r="1.5" />
            <circle cx="15" cy="12" r="1.5" />
            <circle cx="9" cy="19" r="1.5" />
            <circle cx="15" cy="19" r="1.5" />
          </svg>
        </div>
        <div className="flex-1 min-w-0 space-y-1">
          <input
            value={item.name}
            onChange={(e) => onUpdate(item.id, { name: e.target.value })}
            className="w-full rounded border-transparent px-1 py-0.5 text-sm font-medium hover:border-gray-300 focus:border-blue-500 focus:outline-none border"
            aria-label="Item name"
          />
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <label className="flex items-center gap-1">
              Qty:
              <input
                type="number"
                min={1}
                value={item.quantity}
                onChange={(e) =>
                  onUpdate(item.id, {
                    quantity: Math.max(1, parseInt(e.target.value) || 1),
                  })
                }
                className="w-12 rounded border px-1 py-0.5 text-center"
              />
            </label>
            <label className="flex items-center gap-1">
              Price:
              <span className="text-gray-400">$</span>
              <CurrencyInput
                cents={item.priceCents}
                onChangeCents={(cents) =>
                  onUpdate(item.id, { priceCents: cents })
                }
                className="w-20 rounded border px-1 py-0.5"
              />
            </label>
          </div>
        </div>
        <div className="text-right">
          <div className="text-sm font-semibold">
            {formatCents(item.quantity * item.priceCents)}
          </div>
          <button
            type="button"
            onClick={() => onDelete(item.id)}
            className="mt-1 text-xs text-red-500 hover:text-red-700"
            aria-label={`Delete ${item.name}`}
          >
            Delete
          </button>
        </div>
      </div>
      {people.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 pl-1">
          <button
            type="button"
            onClick={() => {
              const allAssigned = people.every((p) =>
                item.assignedTo.includes(p.id)
              );
              const toToggle = allAssigned
                ? people.map((p) => p.id)
                : people.filter((p) => !item.assignedTo.includes(p.id)).map((p) => p.id);
              toToggle.forEach((pid) => onToggleAssignment(item.id, pid));
            }}
            className="rounded-full border border-gray-300 px-2 py-1 text-xs text-gray-500 hover:bg-gray-100"
            aria-label={
              people.every((p) => item.assignedTo.includes(p.id))
                ? "Deselect all people"
                : "Select all people"
            }
          >
            {people.every((p) => item.assignedTo.includes(p.id))
              ? "None"
              : "All"}
          </button>
          {people.map((person) => (
            <PersonChip
              key={person.id}
              name={person.name}
              color={person.color}
              assigned={item.assignedTo.includes(person.id)}
              onToggle={() => onToggleAssignment(item.id, person.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
