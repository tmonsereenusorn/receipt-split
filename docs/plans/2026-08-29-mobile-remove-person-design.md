# Removing a Person on Mobile — Design

**Date:** 2026-08-29
**Status:** Approved

## Problem

Removing a person is effectively unusable on a touch device, and the failure is worse than
"hard to find".

`PeopleBar.tsx` — the component the receipt page actually renders — wraps the rename and
remove controls in:

```
opacity-0 group-hover:opacity-100
```

Touch devices have no hover, so the controls are **invisible but still tappable** — `opacity: 0`
does not remove pointer events. They are `text-xs` glyphs, `gap-0.5` apart, positioned
`-top-1 -right-2` so they overhang the 40 px pill, and they sit inside the same gesture space as
"select person", which is the action used constantly while assigning items.

So on a phone the controls cannot be seen, cannot be aimed at, and cannot be told apart — while
still being reachable by accident. `fsDeletePerson` strips that person from every item
assignment, and the codebase has no confirmation pattern anywhere, so a stray tap silently
undoes assignment work.

This went unnoticed because it only reproduces without a mouse.

## Approach

The section already renders a line under the pills that responds to selection:

```
tap items to assign to Alice
```

That line is where per-person actions belong. It already exists, it already changes when a
person is selected, and it is outside the rapid tap-to-assign path.

**Selecting is unchanged.** Tapping a pill selects, tapping it again deselects, exactly as now.

**The line beneath becomes the selected person's action row.** Rename and remove appear as text
targets in the receipt's own vernacular rather than floating icons — the section is already
handwriting and monospace, and a glyph button pinned to a circle is neither.

**Nothing is hover-gated, so desktop and mobile behave identically.** The existing hover controls
are deleted rather than kept as a shortcut; two affordances for one action is how the mobile gap
appeared in the first place.

## The action row

```
  (A) (B) (C)  ⊕

  tap items to assign to Alice
  rename · remove
```

Removing is a two-step in place, not a modal — the codebase has no dialog component and does not
need one for this:

```
  rename · remove
        ↓ tap remove
  really? removes Alice from 4 items · cancel
```

The count is the point. Deleting a person is more destructive than deleting an item, because it
silently unpicks assignment work, and the consequence should be visible **before** the second
tap rather than discovered afterwards. When the person is on no items the line reads simply
`really? · cancel`.

Confirmation resets whenever the selected person changes, so a pending "really?" cannot be
answered for the wrong person.

**Touch targets.** The text actions carry padding to a minimum 44 px hit area, which the current
`text-xs` glyphs miss by a wide margin.

## Implementation

`src/components/receipt/PeopleBar.tsx` — **the component `ReceiptPageClient` imports**. A
second, near-identical `PeopleSection.tsx` existed with no importers; the first attempt at this
change edited that one, so every part of it was invisible to users while the build, the
typechecker, and the tests all passed. That file is deleted as part of this work: two components
for one concern is what made the mistake possible, and leaving it would preserve the trap. The hook, the Firestore layer, and
`fsDeletePerson` are unchanged — this is an affordance problem, not a data one.

- delete the `opacity-0 group-hover:opacity-100` block and its two glyph buttons
- add `confirmingFor: string | null` — the person being confirmed, not a boolean — and clear it
  on **every** selection change. Comparing it to the active person only *suppresses* a stale
  confirmation; deselecting and re-selecting the same person would otherwise restore an armed
  delete exactly where `rename` normally sits
- render the action row when `activePerson` is set, replacing the bare assign hint
- rename reuses the existing `startEdit` inline flow
- remove calls the existing `onDelete`

## Testing

Vitest runs in the `node` environment, so the component cannot be unit-tested. The logic worth
pinning is the consequence count, which is a pure function of items and a person id, so it moves
to `src/lib/people.ts`:

- `countAssignedItems(items, personId)` — counts items the person is on; zero when unassigned;
  unaffected by other people's assignments

A passing suite is not evidence that a component change reached the app. These tests cover the
pure helper, which was correct while the component work landed in a file nothing imported.
Confirm the render path by grepping for the importer, not by the test count.

The interaction itself is verified by reading and by exercising the built app at a phone
viewport, since there is no jsdom to render into.

## Out of scope

- Undo after removal. Worth doing, but it needs a general mechanism rather than one bolted to
  this section.
- Reworking `ItemRow`'s swipe-to-delete, which has the same no-confirmation property but is a
  discoverable gesture with a visible strike animation.
