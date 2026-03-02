# Delete Item UX — Design

## Problem

The current "delete item" text button is buried at the bottom of the expanded item card. There's no way to delete from collapsed rows, requiring expand → scroll → tap. This is slow and not discoverable.

## Solution

Two complementary delete mechanisms:

### 1. Expanded view: Trash icon (top-right)

- Remove "delete item" text button from bottom of expanded card
- Add a small trash icon in the top-right of the expanded section, inline with the edit fields row
- Styled subtle (zinc-500, small) — turns red on hover/tap
- Single tap deletes the item

### 2. Collapsed view: Swipe-left-to-reveal

- Swipe left on a collapsed item row slides the row content left, revealing a red delete zone (~80px) on the right
- Red zone contains a trash icon — tapping it deletes the item
- Releasing without tapping snaps the row back to its original position
- Pure touch events (`touchstart`, `touchmove`, `touchend`) + CSS transform — no external library

### Swipe behavior details

- **Threshold:** ~50px horizontal drag before locking into swipe mode (prevents accidental triggers from vertical scrolling)
- **Vertical lock:** If user starts scrolling vertically first, swipe does not activate
- **Active person mode:** Swipe is disabled when `activePerson` is set (row taps are used for item assignment, not deletion)
- **Snap back:** On touch end, if user hasn't tapped delete, row animates back to original position

## Unchanged

- Expanded card still has edit fields (name, qty, price) and person assignment chips
- Row tap behavior (expand/collapse or assign) unchanged
- Left border color feedback unchanged
