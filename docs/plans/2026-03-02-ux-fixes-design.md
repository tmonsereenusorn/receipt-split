# UX Fixes Design — 5 Improvements

## Goal

Address 5 UX issues that surfaced after the receipt UI overhaul. All fixes must be visually cohesive with the skeuomorphic cream-paper receipt theme.

## Fix 1: Divider Between People and Items

**Problem:** The `+ add` button in the Items header looks like it could belong to People. No clear visual boundary.

**Solution:** Add a `================================` double-line separator between the People and Items sections. This is the receipt's established "major section break" language (used at header and totals).

**Implementation:** In `receipt/[id]/page.tsx`, add a `receipt-separator` div with `===` text between PeopleSection and ItemsSection.

## Fix 2: Checkmark Button on Person Name Input

**Problem:** Adding a person on mobile requires pressing Return on the keyboard. No visible submit affordance.

**Solution:**
- Add a `✓` checkmark button after the name input field
- Styled: `font-receipt text-lg text-ink cursor-pointer hover:text-ink-muted`
- Tapping submits the form (same as Enter)
- Same treatment for the edit-person input
- When input is empty/whitespace, checkmark is `text-ink-faded` and disabled

## Fix 3: New Items Appear at Top

**Problem:** New items append to the bottom, requiring the user to scroll down past existing items.

**Solution:** Change `fsAddItem` in `firestore.ts` to prepend: `[item, ...data.items]` instead of `[...data.items, item]`. One-line change.

## Fix 4: Drag Handle to Reorder Items

**Problem:** No way to reorder items on the receipt.

**Solution:**
- Add grip dots `⠇` on the left edge of each collapsed item row
- Styled: `text-ink-faded cursor-grab` (becomes `cursor-grabbing` during drag)
- Touch+hold the grip to initiate drag via pointer events (not HTML5 drag API — better mobile support)
- During drag: the item gets slight elevation (`shadow-md`), other items shift to show insertion point (thin `border-top` line in ink color)
- On release: call a new `fsReorderItem(receiptId, itemId, newIndex)` to move the item to the target position
- Grip is hidden when an `activePerson` is selected (assignment mode) — same as swipe-to-delete
- Grip is hidden in print view

**New Firestore function:** `fsReorderItem(id, itemId, newIndex)` — atomically removes item from current position and inserts at `newIndex`.

## Fix 5: Visual Indication for Unassigned Items

**Problem:** When people exist but an item has no assignments, there's no clear visual warning.

**Solution:**
- When `people.length > 0 && item.assignedTo.length === 0`:
  - Item row text: `text-accent` (red) instead of `text-ink`
  - Small `*` asterisk after the price, also in `text-accent`
  - The "(tap to assign)" text below changes from `text-ink-faded` to `text-accent`
- When no people exist, items display normally (no red — nothing to assign to)
- This creates a clear "needs attention" signal without being obnoxious

## Non-Goals

- No new features beyond these 5 fixes
- No data model changes (except the new Firestore reorder function)
- No changes to the overall receipt theme
