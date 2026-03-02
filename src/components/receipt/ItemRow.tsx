"use client";

import { useState, useEffect, useRef } from "react";
import { ReceiptItem, Person } from "@/types";
import { formatCents } from "@/lib/format";
import { CurrencyInput } from "@/components/ui/CurrencyInput";

interface ItemRowProps {
  item: ReceiptItem;
  people: Person[];
  activePerson: string | null;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onUpdate: (id: string, updates: Partial<Omit<ReceiptItem, "id">>) => void;
  onDelete: (id: string) => void;
  onToggleAssignment: (itemId: string, personId: string) => void;
}

export function ItemRow({
  item,
  people,
  activePerson,
  isExpanded,
  onToggleExpand,
  onUpdate,
  onDelete,
  onToggleAssignment,
}: ItemRowProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [localName, setLocalName] = useState(item.name);
  const [localQty, setLocalQty] = useState(String(item.quantity));
  const isNameFocused = useRef(false);
  const isQtyFocused = useRef(false);
  const prevName = useRef(item.name);
  const prevQty = useRef(item.quantity);

  useEffect(() => {
    if (!isNameFocused.current && item.name !== prevName.current) {
      setLocalName(item.name);
    }
    prevName.current = item.name;
  }, [item.name]);

  useEffect(() => {
    if (!isQtyFocused.current && item.quantity !== prevQty.current) {
      setLocalQty(String(item.quantity));
    }
    prevQty.current = item.quantity;
  }, [item.quantity]);

  const total = item.quantity * item.priceCents;
  const isUnassigned = people.length > 0 && item.assignedTo.length === 0;
  const allAssigned = people.length > 0 && people.every((p) => item.assignedTo.includes(p.id));

  return (
    <div
      className="transition-colors border-l-2"
      style={{
        borderLeftColor: activePerson
          ? item.assignedTo.includes(activePerson)
            ? (people.find((p) => p.id === activePerson)?.color ?? "transparent")
            : "transparent"
          : isUnassigned
            ? "rgba(245, 158, 11, 0.6)"
            : "transparent",
      }}
    >
      {/* Collapsed row: receipt line */}
      <button
        type="button"
        onClick={() => {
          if (activePerson) {
            onToggleAssignment(item.id, activePerson);
          } else {
            onToggleExpand();
          }
        }}
        className="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-zinc-800/50"
      >
        {/* Quantity */}
        <span className="w-6 shrink-0 font-mono text-xs text-zinc-500">
          {item.quantity}×
        </span>

        {/* Name */}
        <span className="min-w-0 flex-1 truncate text-sm text-zinc-200">
          {item.name}
        </span>

        {/* Assigned dots */}
        {!isExpanded && item.assignedTo.length > 0 && (
          <span className="flex shrink-0 gap-0.5">
            {item.assignedTo.map((pid) => {
              const person = people.find((p) => p.id === pid);
              return person ? (
                <span
                  key={pid}
                  className="inline-block h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: person.color }}
                />
              ) : null;
            })}
          </span>
        )}

        {/* Price */}
        <span className="shrink-0 font-mono text-sm text-zinc-300">
          {formatCents(total)}
        </span>
      </button>

      {/* Expanded: edit + assignment */}
      {isExpanded && (
        <div className="space-y-3 bg-zinc-800/30 px-3 pb-3">
          {/* Edit fields */}
          <div className="flex items-center gap-3 pt-1">
            <input
              value={localName}
              onChange={(e) => setLocalName(e.target.value)}
              onFocus={() => { isNameFocused.current = true; }}
              onBlur={() => {
                isNameFocused.current = false;
                onUpdate(item.id, { name: localName });
              }}
              onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
              className="min-w-0 flex-1 border-b border-amber-500/50 bg-transparent py-1 text-sm text-zinc-200 focus:border-amber-500 focus:outline-none"
              aria-label="Item name"
            />
            <label className="flex items-center gap-1 text-xs text-zinc-500">
              qty
              <input
                type="number"
                min={1}
                value={localQty}
                onChange={(e) => setLocalQty(e.target.value)}
                onFocus={() => { isQtyFocused.current = true; }}
                onBlur={() => {
                  isQtyFocused.current = false;
                  const parsed = Math.max(1, parseInt(localQty) || 1);
                  setLocalQty(String(parsed));
                  onUpdate(item.id, { quantity: parsed });
                }}
                onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
                className="w-10 rounded border border-zinc-700 bg-zinc-900 px-1 py-0.5 text-center font-mono text-xs text-zinc-300"
              />
            </label>
            <label className="flex items-center gap-1 text-xs text-zinc-500">
              $
              <CurrencyInput
                cents={item.priceCents}
                onChangeCents={(cents) =>
                  onUpdate(item.id, { priceCents: cents })
                }
                className="w-16 rounded border border-zinc-700 bg-zinc-900 px-1 py-0.5 font-mono text-xs text-zinc-300"
              />
            </label>
          </div>

          {/* Person assignment chips */}
          {people.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  const toToggle = allAssigned
                    ? people.map((p) => p.id)
                    : people.filter((p) => !item.assignedTo.includes(p.id)).map((p) => p.id);
                  toToggle.forEach((pid) => onToggleAssignment(item.id, pid));
                }}
                className="rounded-full border border-zinc-700 px-2 py-0.5 text-xs text-zinc-500 hover:bg-zinc-800"
              >
                {allAssigned ? "none" : "all"}
              </button>
              {people.map((person) => {
                const assigned = item.assignedTo.includes(person.id);
                return (
                  <button
                    key={person.id}
                    type="button"
                    onClick={() => onToggleAssignment(item.id, person.id)}
                    className="rounded-full px-2.5 py-0.5 text-xs font-medium transition-all"
                    style={
                      assigned
                        ? { backgroundColor: person.color, color: "#18181b" }
                        : { border: `1px solid ${person.color}60`, color: person.color }
                    }
                    aria-pressed={assigned}
                    aria-label={`${assigned ? "Unassign" : "Assign"} ${person.name}`}
                  >
                    {person.name}
                  </button>
                );
              })}
            </div>
          )}

          {/* Delete */}
          <button
            type="button"
            onClick={() => onDelete(item.id)}
            className="text-xs text-red-400/70 hover:text-red-400"
          >
            delete item
          </button>
        </div>
      )}
    </div>
  );
}
