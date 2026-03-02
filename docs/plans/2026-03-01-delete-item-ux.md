# Delete Item UX Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the "delete item" text button with a compact trash icon in expanded view, and add swipe-left-to-reveal-delete on collapsed rows.

**Architecture:** Single file change to `ItemRow.tsx`. Expanded view: move delete from bottom text to a trash icon in the top-right of the edit fields row. Collapsed view: wrap the row button in a swipe container that uses touch events + CSS transform to slide the content left, revealing a red delete zone underneath. Swipe is disabled when `activePerson` is set.

**Tech Stack:** React (useState, useRef, useCallback), touch events, CSS transform/transition, Tailwind CSS

---

### Task 1: Replace "delete item" text with trash icon in expanded view

**Files:**
- Modify: `src/components/receipt/ItemRow.tsx`

**Step 1: Remove the "delete item" text button**

Delete lines 197-204 (the delete button at the bottom of the expanded section):

```tsx
          {/* Delete */}
          <button
            type="button"
            onClick={() => onDelete(item.id)}
            className="text-xs text-red-400/70 hover:text-red-400"
          >
            delete item
          </button>
```

**Step 2: Add trash icon button to the edit fields row**

In the expanded section, the edit fields row is at line 116:
```tsx
<div className="flex items-center gap-3 pt-1">
```

Add a trash icon button at the end of this flex row, after the `$` / `CurrencyInput` label (after line 156's closing `</label>`), before the closing `</div>` on line 157:

```tsx
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
```

**Step 3: Verify build**

Run: `npm run build`
Expected: Compiled successfully.

**Step 4: Commit**

```bash
git add src/components/receipt/ItemRow.tsx
git commit -m "feat: replace delete text with trash icon in expanded item row"
```

---

### Task 2: Add swipe-left-to-reveal-delete on collapsed rows

**Files:**
- Modify: `src/components/receipt/ItemRow.tsx`

**Step 1: Add swipe state and refs**

After the existing refs (after line 35 `const prevQty = useRef(item.quantity);`), add:

```tsx
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isSwipeOpen, setIsSwipeOpen] = useState(false);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const swipeDirection = useRef<"none" | "horizontal" | "vertical">("none");
  const DELETE_ZONE_WIDTH = 72;
  const SWIPE_THRESHOLD = 50;
```

**Step 2: Add touch event handlers**

After the swipe state/refs block, add three handler functions:

```tsx
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (activePerson || isExpanded) return;
    const touch = e.touches[0];
    touchStartX.current = touch.clientX;
    touchStartY.current = touch.clientY;
    swipeDirection.current = "none";
  }, [activePerson, isExpanded]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (activePerson || isExpanded) return;
    const touch = e.touches[0];
    const dx = touch.clientX - touchStartX.current;
    const dy = touch.clientY - touchStartY.current;

    // Determine swipe direction on first significant movement
    if (swipeDirection.current === "none") {
      if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
        swipeDirection.current = Math.abs(dx) > Math.abs(dy) ? "horizontal" : "vertical";
      }
      return;
    }

    if (swipeDirection.current === "vertical") return;

    // Horizontal swipe: calculate offset
    const base = isSwipeOpen ? -DELETE_ZONE_WIDTH : 0;
    const raw = base + dx;
    // Clamp between -DELETE_ZONE_WIDTH and 0
    const clamped = Math.max(-DELETE_ZONE_WIDTH, Math.min(0, raw));
    setSwipeOffset(clamped);
  }, [activePerson, isExpanded, isSwipeOpen]);

  const handleTouchEnd = useCallback(() => {
    if (activePerson || isExpanded) return;
    if (swipeDirection.current !== "horizontal") {
      return;
    }
    // Snap open or closed based on threshold
    if (Math.abs(swipeOffset) > SWIPE_THRESHOLD) {
      setSwipeOffset(-DELETE_ZONE_WIDTH);
      setIsSwipeOpen(true);
    } else {
      setSwipeOffset(0);
      setIsSwipeOpen(false);
    }
  }, [activePerson, isExpanded, swipeOffset]);
```

Add `useCallback` to the import on line 3:

```tsx
import { useState, useEffect, useRef, useCallback } from "react";
```

**Step 3: Reset swipe when row expands or activePerson changes**

After the existing `useEffect` blocks (after line 49), add:

```tsx
  useEffect(() => {
    setSwipeOffset(0);
    setIsSwipeOpen(false);
  }, [isExpanded, activePerson]);
```

**Step 4: Wrap the collapsed row in a swipe container**

Replace the current outer `<div>` structure. The existing code at lines 56-67 is:

```tsx
    <div
      className="transition-colors border-l-2"
      style={{...}}
    >
      {/* Collapsed row: receipt line */}
      <button ...>
```

Wrap the collapsed row `<button>` in a swipe container. The new structure becomes:

The outer `<div>` keeps its border-l styling. Inside, add a container div that holds both the delete zone (positioned behind) and the slideable row content.

Replace the `{/* Collapsed row: receipt line */}` comment and `<button>` block (lines 68-110) with:

```tsx
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
            transition: swipeDirection.current === "horizontal" ? "none" : "transform 200ms ease-out",
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
```

**Step 5: Fix transition during active swipe**

The `style` on the button uses `swipeDirection.current` but refs don't trigger re-renders. Replace the transition logic: during `handleTouchMove`, we shouldn't animate (instant follow). On `handleTouchEnd`, the snap animation uses CSS transition. To achieve this cleanly, add a ref:

```tsx
const isTouching = useRef(false);
```

Set `isTouching.current = true` at the start of `handleTouchStart`, and `isTouching.current = false` at the end of `handleTouchEnd`.

Then use in the style:
```tsx
style={{
  transform: `translateX(${swipeOffset}px)`,
  transition: isTouching.current ? "none" : "transform 200ms ease-out",
}}
```

**Step 6: Verify build**

Run: `npm run build`
Expected: Compiled successfully.

**Step 7: Run all tests**

Run: `npm test`
Expected: All tests pass.

**Step 8: Commit**

```bash
git add src/components/receipt/ItemRow.tsx
git commit -m "feat: add swipe-left-to-reveal-delete on collapsed item rows"
```
