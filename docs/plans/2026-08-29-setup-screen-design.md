# Setup Screen — Design

**Date:** 2026-08-29
**Status:** Approved

## Problem

Creating a shplit drops the user straight onto the receipt page, where two things they
almost always know up front are missing:

- **Who was at the meal.** People are added one at a time on the receipt page, interleaved
  with assigning items, so the group is assembled while the work is already underway.
- **Whether a tip is being added.** `initialTip` is `{ isPercent: true, percent: 20 }`, so
  every receipt silently carries a 20% tip nobody asked for. It inflates the total until
  someone notices the TIP row — the same phantom-value problem that a phantom 7% tax had
  before charges replaced it.

A short step between "create a shplit" and the receipt page can collect both.

## Flow

The step appears immediately after the user commits to creating a receipt — for the scan
path, as soon as the photo is taken, **while the scan runs behind it**. A scan takes
5–10 seconds; spending it on a form the user has to fill anyway hides the latency, and by
the time they press Continue the result is usually already in hand.

```
[Scan receipt]  → photo → setup step (scan running) → Continue → receipt page
[Enter manually] →        setup step                → Continue → receipt page
```

**The step is page state, not a route.** The in-flight scan promise has to survive the
step, and a route change would mean marshalling the image and the pending request through
navigation. `src/app/page.tsx` becomes a small machine — `idle → setup → creating` — with
the scan promise held in a ref. Consequence: the step is not linkable and not reachable by
the back button. That is the accepted trade for keeping the scan alive.

## The screen

Two blocks, in the app's receipt-tape style:

1. **Who was there?** — a list of name inputs with add and remove. Empty is allowed;
   Continue works with zero people, because people can still be added on the receipt page.
   This is a shortcut, not a gate.
2. **Tip not on the bill** — a checkbox. When checked it reveals a percentage field with
   the existing `TIP_PRESETS` (15/18/20/25). When unchecked, no percentage is shown.

## Tip resolution

Two sources can supply a tip: the checkbox, and a tip line the scan finds printed on the
bill. The user answers before the scan result exists, so they can disagree.

**An active choice overrides the bill; inaction does not.**

| Setup answer | Bill | Result |
| --- | --- | --- |
| checked, N% | tip printed | **N%** — the user's explicit choice wins |
| checked, N% | no tip | **N%** |
| unchecked | tip printed | **the printed tip** |
| unchecked | no tip | **$0.00** |

The asymmetry is deliberate. Unchecked is the default state, so treating it as a
deliberate "no tip" would let someone discard a real printed tip merely by pressing
Continue without reading. Checking the box is an action; leaving it alone is not.

**Behavior change:** a receipt created with the box unchecked and no tip on the bill now
carries a `$0.00` tip instead of a silent 20%. Totals on new receipts will be lower than
they would have been, and correct.

## Implementation

**`src/lib/setup.ts`** — the decisions, as pure functions. Vitest runs in the `node`
environment with no jsdom, so the component itself cannot be unit-tested; the logic that
matters must live where it can be.

```ts
/** Names as typed → people, blanks dropped, colors cycled from PERSON_COLORS. */
export function buildInitialPeople(names: string[]): Person[]

export interface SetupTipAnswer {
  enabled: boolean;
  percent: number;
}

/** Implements the table above. */
export function resolveInitialTip(
  answer: SetupTipAnswer,
  parsedTipCents: number | null
): Tip
```

`buildInitialPeople` mints ids the same way `useFirestoreReceipt.addPerson` does and
cycles `PERSON_COLORS` with `index % PERSON_COLORS.length`, so a group larger than the
palette still gets distinct-looking neighbours.

**`src/components/receipt/SetupSection.tsx`** — presentation only: name rows, the tip
checkbox, the percent field, and Continue. All state lifted to `page.tsx`.

**`src/app/page.tsx`** — holds the step state and the scan promise, calls the two pure
functions, and passes `people` and `tip` into the existing `createReceipt`, which already
accepts both.

## Scan failure

If the scan fails while the user is on the setup step, the failure message renders there
with a Retake action, preserving today's recovery path. Without it a user could fill the
form and press Continue against a scan that had already failed.

## Testing

TDD throughout.

- **`buildInitialPeople`** — blanks and whitespace-only names dropped; names trimmed;
  colors cycle past the palette length; duplicate names allowed (two people can share one);
  empty input → `[]`
- **`resolveInitialTip`** — all four cells of the table, plus a parsed tip of `0`
  (a printed `$0.00` tip is still a printed tip and must not be confused with absence)
- **End-to-end** — a scanned receipt with a printed tip and the box left unchecked keeps
  the printed tip; with the box checked, the percentage wins

## Out of scope

- Editing or reordering people on the setup step beyond add/remove
- Remembering a previous group across receipts
- A cash tip entered as an amount rather than a percentage
- Making the step linkable or back-navigable
