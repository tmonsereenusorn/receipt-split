"use client";

import { useState, useEffect, useRef, useCallback } from "react";
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

  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isSwipeOpen, setIsSwipeOpen] = useState(false);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const isTouching = useRef(false);
  const swipeDirection = useRef<"none" | "horizontal" | "vertical">("none");
  const DELETE_ZONE_WIDTH = 72;
  const SWIPE_THRESHOLD = 50;

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

  useEffect(() => {
    setSwipeOffset(0);
    setIsSwipeOpen(false);
  }, [isExpanded, activePerson]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (activePerson || isExpanded) return;
    const touch = e.touches[0];
    touchStartX.current = touch.clientX;
    touchStartY.current = touch.clientY;
    swipeDirection.current = "none";
    isTouching.current = true;
  }, [activePerson, isExpanded]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (activePerson || isExpanded || !isTouching.current) return;
    const touch = e.touches[0];
    const dx = touch.clientX - touchStartX.current;
    const dy = touch.clientY - touchStartY.current;

    if (swipeDirection.current === "none") {
      if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
        swipeDirection.current = Math.abs(dx) > Math.abs(dy) ? "horizontal" : "vertical";
      }
      return;
    }

    if (swipeDirection.current === "vertical") return;

    const base = isSwipeOpen ? -DELETE_ZONE_WIDTH : 0;
    const raw = base + dx;
    const clamped = Math.max(-DELETE_ZONE_WIDTH, Math.min(0, raw));
    setSwipeOffset(clamped);
  }, [activePerson, isExpanded, isSwipeOpen]);

  const handleTouchEnd = useCallback(() => {
    if (activePerson || isExpanded) return;
    isTouching.current = false;
    if (swipeDirection.current !== "horizontal") return;
    if (Math.abs(swipeOffset) > SWIPE_THRESHOLD) {
      setSwipeOffset(-DELETE_ZONE_WIDTH);
      setIsSwipeOpen(true);
    } else {
      setSwipeOffset(0);
      setIsSwipeOpen(false);
    }
  }, [activePerson, isExpanded, swipeOffset]);

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
            ? "rgb(239, 68, 68)"
            : "transparent",
      }}
    >
      {/* Swipe container */}
      <div className="relative overflow-hidden">
        {/* Delete zone (revealed on swipe) */}
        {swipeOffset < 0 && (
          <button
            type="button"
            onClick={() => {
              onDelete(item.id);
              setSwipeOffset(0);
              setIsSwipeOpen(false);
            }}
            className="absolute inset-y-0 right-0 flex items-center justify-center bg-red-600 px-5 text-white transition-colors hover:bg-red-500"
            style={{ width: DELETE_ZONE_WIDTH }}
            aria-label="Delete item"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
              <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 0 0 6 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 1 0 .23 1.482l.149-.022.841 10.518A2.75 2.75 0 0 0 7.596 19h4.807a2.75 2.75 0 0 0 2.742-2.53l.841-10.52.149.023a.75.75 0 0 0 .23-1.482A41.03 41.03 0 0 0 14 4.193V3.75A2.75 2.75 0 0 0 11.25 1h-2.5ZM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4ZM8.58 7.72a.75.75 0 0 0-1.5.06l.3 7.5a.75.75 0 1 0 1.5-.06l-.3-7.5Zm4.34.06a.75.75 0 1 0-1.5-.06l-.3 7.5a.75.75 0 1 0 1.5.06l.3-7.5Z" clipRule="evenodd" />
            </svg>
          </button>
        )}

        {/* Slideable row content */}
        <button
          type="button"
          onClick={() => {
            if (isSwipeOpen) {
              setSwipeOffset(0);
              setIsSwipeOpen(false);
              return;
            }
            if (activePerson) {
              onToggleAssignment(item.id, activePerson);
            } else {
              onToggleExpand();
            }
          }}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          className="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-zinc-800/50 relative bg-zinc-900"
          style={{
            transform: `translateX(${swipeOffset}px)`,
            transition: isTouching.current ? "none" : "transform 200ms ease-out",
          }}
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
      </div>

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
            <button
              type="button"
              onClick={() => onDelete(item.id)}
              className="shrink-0 p-1 text-zinc-600 transition-colors hover:text-red-400"
              aria-label="Delete item"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 0 0 6 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 1 0 .23 1.482l.149-.022.841 10.518A2.75 2.75 0 0 0 7.596 19h4.807a2.75 2.75 0 0 0 2.742-2.53l.841-10.52.149.023a.75.75 0 0 0 .23-1.482A41.03 41.03 0 0 0 14 4.193V3.75A2.75 2.75 0 0 0 11.25 1h-2.5ZM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4ZM8.58 7.72a.75.75 0 0 0-1.5.06l.3 7.5a.75.75 0 1 0 1.5-.06l-.3-7.5Zm4.34.06a.75.75 0 1 0-1.5-.06l-.3 7.5a.75.75 0 1 0 1.5.06l.3-7.5Z" clipRule="evenodd" />
              </svg>
            </button>
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
                className="rounded border border-dashed border-zinc-600 px-2 py-0.5 font-mono text-xs text-zinc-500 hover:border-zinc-500 hover:text-zinc-400"
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

        </div>
      )}
    </div>
  );
}
