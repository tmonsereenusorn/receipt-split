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
2. **Was the tip on the bill?** — a required Yes/No question. Answering No reveals a
   percentage field with the `TIP_PRESETS` (0/15/18/20/25). Continue stays disabled until
   the question is answered, so no default carries meaning.

   `0` is a first-class preset: tipping is not customary in much of the world, and the app
   already picks its currency from the locale, so a non-tipping region is ordinary rather
   than an edge case.

   Answers are **drawn, not typeset**. The app already marks paper in red pen
   (`.strikethrough-line`), so the check, the cross, and the circle around the chosen one
   are SVG strokes in the same accent — printed things are type, marked things are strokes.
   Glyph ✓/✗ would read as typeset and sit at odds with the receipt mono around them. The
   circle overshoots its own start and sits a few degrees off-axis, because a real circled
   answer is never closed cleanly; it draws in on selection and is static under
   `prefers-reduced-motion`.

## Tip resolution

Two sources can supply a tip: the answer, and a tip line the scan finds printed on the
bill. The user answers before the scan result exists, so they can disagree.

**Because the question is required, both answers are deliberate** and neither needs to
defer to the other:

| Answer | Bill | Result |
| --- | --- | --- |
| on the bill | tip printed | **the printed tip** |
| on the bill | no tip | **$0.00** |
| not on the bill | either | **the entered percentage** |

Answering "on the bill" when the scan found none yields no tip rather than an invented
one — the TIP row stays editable on the receipt page.

An earlier revision of this document made the question an optional checkbox, which forced
an asymmetry: a default state must not silently discard a printed tip, so unchecked could
not override the bill while checked could. Asking outright removes the default and with it
the special case.

**Behavior change:** receipts no longer carry the silent 20% tip that `initialTip` applies
to every receipt today regardless of intent. Totals on new receipts will be lower, and
correct. Existing receipts are untouched.

## Implementation

**`src/lib/setup.ts`** — the decisions, as pure functions. Vitest runs in the `node`
environment with no jsdom, so the component itself cannot be unit-tested; the logic that
matters must live where it can be.

```ts
/** Names as typed → people, blanks dropped, colors cycled from PERSON_COLORS. */
export function buildInitialPeople(names: string[]): Person[]

export interface SetupTipAnswer {
  /** Whether the tip was already printed on the bill. */
  onBill: boolean;
  /** Percentage to add, meaningful only when it was NOT on the bill. */
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

**`src/components/receipt/SetupSection.tsx`** — presentation only: name rows, the required
Yes/No question with its pen marks, the percent field, and Continue. All state is lifted to
`page.tsx`.

**`src/app/page.tsx`** — holds the step state and the scan promise, calls the two pure
functions, and passes `people` and `tip` into the existing `createReceipt`, which already
accepts both.

## Scan failure

If the scan fails while the user is on the setup step, **the route's own message** renders
there with a Retake action. The route distinguishes seven failures, and their advice
differs — "too many items, split it into two photos" is a different remedy from "try a
clearer photo", and these failures reproduce on a re-shoot, so collapsing them to one
generic line leaves the user with no way to learn the actual fix.

The scan resolves to a discriminated `ScanOutcome` carrying that message rather than a bare
`null`. Without the failure screen a user could fill the form and press Continue against a
scan that had already failed.

## Testing

TDD throughout.

- **`buildInitialPeople`** — blanks and whitespace-only names dropped; names trimmed;
  colors cycle past the palette length; duplicate names allowed (two people can share one);
  empty input → `[]`
- **`resolveInitialTip`** — every cell of the table, plus a parsed tip of `0` (a printed
  `$0.00` tip is still printed and must not be confused with absence), and a fractional
  percentage surviving intact
- **End-to-end** — a scanned receipt with a printed tip and "on the bill" answered keeps
  the printed tip; answering "not on the bill" uses the percentage instead

## Out of scope

- Editing or reordering people on the setup step beyond add/remove
- Remembering a previous group across receipts
- A cash tip entered as an amount rather than a percentage
- Making the step linkable or back-navigable
