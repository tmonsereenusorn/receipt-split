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
  const [localName, setLocalName] = useState(item.name);
  const [localQty, setLocalQty] = useState(String(item.quantity));
  const isNameFocused = useRef(false);
  const isQtyFocused = useRef(false);

  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isStruck, setIsStruck] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const swipeOffsetRef = useRef(0);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const isTouching = useRef(false);
  const swipeDirection = useRef<"none" | "horizontal" | "vertical">("none");
  const rowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isNameFocused.current) setLocalName(item.name);
  }, [item.name]);

  useEffect(() => {
    if (!isQtyFocused.current) setLocalQty(String(item.quantity));
  }, [item.quantity]);

  useEffect(() => {
    setSwipeOffset(0);
    setIsStruck(false);
  }, [isExpanded, activePerson]);

  const didSwipe = useRef(false);

  const handlePointerStart = useCallback((clientX: number, clientY: number) => {
    if (activePerson || isExpanded) return;
    touchStartX.current = clientX;
    touchStartY.current = clientY;
    swipeDirection.current = "none";
    isTouching.current = true;
    didSwipe.current = false;
  }, [activePerson, isExpanded]);

  const handlePointerMove = useCallback((clientX: number, clientY: number) => {
    if (activePerson || isExpanded || !isTouching.current) return;
    const dx = clientX - touchStartX.current;
    const dy = clientY - touchStartY.current;

    if (swipeDirection.current === "none") {
      if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
        swipeDirection.current = Math.abs(dx) > Math.abs(dy) ? "horizontal" : "vertical";
      }
      return;
    }

    if (swipeDirection.current === "vertical") return;

    didSwipe.current = true;
    const raw = dx;
    const clamped = Math.min(0, raw);
    swipeOffsetRef.current = clamped;
    setSwipeOffset(clamped);

    // Check if we've passed the 40% threshold
    const rowWidth = rowRef.current?.offsetWidth ?? 300;
    const shouldStrike = Math.abs(clamped) / rowWidth >= 0.4;
    setIsStruck(shouldStrike);
  }, [activePerson, isExpanded]);

  const handlePointerEnd = useCallback(() => {
    if (activePerson || isExpanded) return;
    isTouching.current = false;
    if (swipeDirection.current !== "horizontal") return;

    const rowWidth = rowRef.current?.offsetWidth ?? 300;
    const pastThreshold = Math.abs(swipeOffsetRef.current) / rowWidth >= 0.4;

    if (pastThreshold) {
      // Keep struck, trigger removal animation
      setIsStruck(true);
      setIsRemoving(true);
      setTimeout(() => {
        onDelete(item.id);
      }, 300);
    } else {
      // Snap back
      swipeOffsetRef.current = 0;
      setSwipeOffset(0);
      setIsStruck(false);
    }
  }, [activePerson, isExpanded, onDelete, item.id]);

  // Touch handlers
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    handlePointerStart(e.touches[0].clientX, e.touches[0].clientY);
  }, [handlePointerStart]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    handlePointerMove(e.touches[0].clientX, e.touches[0].clientY);
  }, [handlePointerMove]);

  const handleTouchEnd = useCallback(() => {
    handlePointerEnd();
  }, [handlePointerEnd]);

  // Mouse handlers (for desktop)
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (activePerson || isExpanded) return;
    handlePointerStart(e.clientX, e.clientY);

    const onMouseMove = (ev: MouseEvent) => {
      handlePointerMove(ev.clientX, ev.clientY);
    };
    const onMouseUp = () => {
      handlePointerEnd();
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  }, [activePerson, isExpanded, handlePointerStart, handlePointerMove, handlePointerEnd]);

  const total = item.quantity * item.priceCents;
  const allAssigned = people.length > 0 && people.every((p) => item.assignedTo.includes(p.id));
  const assignedPeople = people.filter((p) => item.assignedTo.includes(p.id));

  const handleToggleAll = () => {
    const toToggle = allAssigned
      ? people.map((p) => p.id)
      : people.filter((p) => !item.assignedTo.includes(p.id)).map((p) => p.id);
    toToggle.forEach((pid) => onToggleAssignment(item.id, pid));
  };

  return (
    <div
      ref={rowRef}
      className={`overflow-hidden transition-all duration-300 ${isRemoving ? "max-h-0 opacity-0" : "max-h-96"}`}
    >
      {/* Swipe container */}
      <div className="relative overflow-hidden">
        {/* Slideable row content */}
        <div
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onMouseDown={handleMouseDown}
          style={{
            transform: `translateX(${swipeOffset}px)`,
            transition: isTouching.current ? "none" : "transform 200ms ease-out",
          }}
        >
          {/* Collapsed row - the tappable button */}
          <button
            type="button"
            onClick={() => {
              if (didSwipe.current) return;
              if (activePerson) {
                onToggleAssignment(item.id, activePerson);
              } else {
                onToggleExpand();
              }
            }}
            className={`relative flex w-full items-baseline px-0 py-2 text-left font-receipt text-lg ${
              isStruck ? "text-ink-faded" : "text-ink"
            }`}
          >
            {/* Quantity prefix when > 1 */}
            {item.quantity > 1 && (
              <span className="shrink-0 text-ink-muted">{item.quantity}x&nbsp;</span>
            )}
            {/* Item name */}
            <span className="shrink-0 uppercase">{item.name}</span>
            {/* Dot leaders filling the gap */}
            <span className="mx-1 flex-1 overflow-hidden whitespace-nowrap text-ink-faded" aria-hidden="true">
              {"·".repeat(50)}
            </span>
            {/* Price */}
            <span className="shrink-0">{formatCents(total)}</span>

            {/* SVG strikethrough overlay */}
            {isStruck && (
              <svg
                className="pointer-events-none absolute inset-0 z-10"
                viewBox="0 0 300 24"
                preserveAspectRatio="none"
                aria-hidden="true"
              >
                <path
                  d="M 0,12 Q 15,8 30,12 T 60,12 T 90,12 T 120,12 T 150,12 T 180,12 T 210,12 T 240,12 T 270,12 T 300,12"
                  className="strikethrough-line"
                />
              </svg>
            )}
          </button>

          {/* Person initials below item */}
          {!isExpanded && (
            <div className="flex gap-2 pb-1 pl-4">
              {assignedPeople.length > 0 ? (
                assignedPeople.map((p) => (
                  <span key={p.id} className="font-hand text-base font-bold" style={{ color: p.color }}>
                    {p.name.charAt(0).toUpperCase()}
                  </span>
                ))
              ) : !activePerson ? (
                <span className="font-hand text-sm text-ink-faded italic">
                  (tap to assign)
                </span>
              ) : null}
            </div>
          )}
        </div>
      </div>

      {/* Expanded: edit + assignment */}
      {isExpanded && (
        <div className="space-y-3 px-2 pb-3 pt-1">
          {/* Name input -- underlined blank */}
          <input
            value={localName}
            onChange={(e) => setLocalName(e.target.value)}
            onFocus={() => { isNameFocused.current = true; }}
            onBlur={() => {
              isNameFocused.current = false;
              onUpdate(item.id, { name: localName });
            }}
            onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
            className="w-full border-b-2 border-ink-faded bg-transparent font-receipt text-lg text-ink uppercase focus:border-ink focus:outline-none"
            aria-label="Item name"
          />
          <div className="flex items-center gap-4">
            {/* Qty input */}
            <div className="flex items-center gap-1">
              <span className="font-receipt text-sm text-ink-muted">QTY</span>
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
                className="w-12 border-b-2 border-ink-faded bg-transparent text-center font-receipt text-lg text-ink focus:border-ink focus:outline-none"
              />
            </div>
            {/* Price input */}
            <div className="flex items-center gap-1">
              <span className="font-receipt text-sm text-ink-muted">$</span>
              <CurrencyInput
                cents={item.priceCents}
                onChangeCents={(cents) =>
                  onUpdate(item.id, { priceCents: cents })
                }
                className="w-16 border-b-2 border-ink-faded bg-transparent font-receipt text-lg text-ink focus:border-ink focus:outline-none"
              />
            </div>
            {/* Delete text button */}
            <button
              type="button"
              onClick={() => onDelete(item.id)}
              className="ml-auto font-receipt text-sm text-accent underline"
            >
              delete
            </button>
          </div>

          {/* Person assignment */}
          {people.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleToggleAll}
                className="font-receipt text-xs text-ink-muted underline"
              >
                all/none
              </button>
              {people.map((person) => {
                const isAssigned = item.assignedTo.includes(person.id);
                return (
                  <button
                    key={person.id}
                    type="button"
                    onClick={() => onToggleAssignment(item.id, person.id)}
                    className="flex h-8 w-8 items-center justify-center rounded-full font-hand text-sm font-bold transition-all"
                    style={{
                      backgroundColor: isAssigned ? person.color : "transparent",
                      color: isAssigned ? "#faf5e8" : person.color,
                      border: isAssigned ? "none" : `2px solid ${person.color}`,
                    }}
                    aria-pressed={isAssigned}
                    aria-label={`${isAssigned ? "Unassign" : "Assign"} ${person.name}`}
                  >
                    {person.name.charAt(0).toUpperCase()}
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
