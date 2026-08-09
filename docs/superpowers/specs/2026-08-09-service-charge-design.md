# Service Charge Support — Design

**Date:** 2026-08-09
**Status:** Approved

## Problem

Users report that a service charge or fee on a receipt is not accounted for. Today it is
discarded silently, so the app's total comes out lower than the printed receipt total and
the difference is split by nobody.

## Root cause

`src/app/api/ocr/route.ts` tells the model to keep these off the `items` array:

```
- Exclude tax, tip, subtotal, total, discounts, service charges from items
```

That exclusion is correct and deliberate. A fee listed as a line item would inflate the
subtotal, would need assigning to a person like food, and would make the tax and tip
percentages compound on top of it.

Tax and tip are excluded from `items` and then captured in dedicated fields:

```
- taxCents: the tax amount in integer cents, or null if not found
- tipCents: the tip/gratuity amount in integer cents, or null if not found
```

Service charge is the only entry in the exclusion list with **no matching capture field**,
and `TaxTip` in `src/types/index.ts` models only tax and tip, so there is nowhere to put
it. Tax and tip are excluded-then-captured; service charge is excluded-then-nothing. That
asymmetry is the whole bug.

## Decisions

1. **A service charge gets its own `SERVICE` row**, a third row beside `TAX` and `TIP`,
   distributed proportionally like they are. Rejected alternatives: folding it into the tip
   (mislabels a mandatory fee, and editing the tip would silently erase it), and injecting
   it as a line item (inflates the subtotal, needs assigning, deletable by accident).

2. **A detected service charge defaults the tip to 0%.** A service charge is normally
   auto-gratuity, so tipping on top double-pays. Today a receipt with an 18% service charge
   also receives the default 20% tip, roughly 38% on top of food. The tip row stays fully
   editable for anyone who wants to add more.

## Non-regression invariant

**If no service charge is found, behavior is identical to today.** Most receipts have none.
Two distinct "missing" cases both resolve to zero:

| Case | Handling |
| --- | --- |
| Model returns `serviceChargeCents: null` | `serviceCents` stays `0` from `initialTaxTip`; row hidden in read-only, print, share text, CSV |
| Legacy Firestore doc, key absent entirely | Normalized to `0` at the read boundary |

The tip-zeroing in decision 2 fires **only** when a service charge is actually detected. The
20% tip default is untouched for every other receipt.

## Data model

Extend `TaxTip` in `src/types/index.ts` with a third triplet mirroring the existing two:

```ts
/** Service charge amount in cents */
serviceCents: number;
/** Whether the service charge is expressed as a percentage */
serviceIsPercent: boolean;
/** Service charge percentage (used when serviceIsPercent is true) */
servicePercent: number;
```

`initialTaxTip` adds:

```ts
serviceCents: 0,
serviceIsPercent: false,
servicePercent: 18,
```

Default is a zero fixed amount. Unlike tax (7%) and tip (20%), percent mode is **off** by
default, because most receipts have no service charge and a detected one is a fixed amount.
The `18` is only the starting value if a user toggles to percent mode by hand.

`PersonBreakdown` gains `serviceShareCents: number`.

## Extraction

Add to the prompt's JSON schema in `route.ts`:

```
"serviceChargeCents": number or null,
```

Add mapping rules. The distinction is **mandatory vs. discretionary**, not the wording on
the receipt:

- → `tipCents`: a tip or gratuity line the diner chose or wrote in
- → `serviceChargeCents`: auto-added fees — service charge, service fee, auto-gratuity,
  large-party fee, kitchen or wellness fee, regulatory or health surcharge, delivery fee,
  bag fee
- **Multiple qualifying lines are summed** into one figure, so no extra rows are needed
- `null` when no such line is present

The existing "Exclude ... from items" line stays exactly as it is. Service charges must
still be kept out of `items`; they now have somewhere to go instead.

`src/lib/receiptExtraction.ts` validates `serviceChargeCents` exactly as it already
validates `taxCents` and `tipCents`: a number `>= 0` is rounded, anything else becomes
`null`.

## Split math

In `src/lib/calculator.ts`:

- `getEffectiveServiceCents(taxTip, subtotalCents)` — mirrors `getEffectiveTaxCents`,
  returning `serviceCents` or `subtotal * servicePercent / 100` when `serviceIsPercent`
- Distribute with the existing `distributeProportionally`, which uses last-person-remainder
  so per-person shares sum to the exact total with no lost or invented cents
- `calculateBreakdowns` sets `serviceShareCents` per person and adds it to `totalCents`

**Tax remains a percentage of the subtotal only** and does not compound on the service
charge. Detected tax is a fixed amount read off the receipt, so percent mode is a manual
fallback and compounding would surprise more than it would help.

## Tip zeroing

In `src/components/receipt/ScanSection.tsx`, where the extraction result is mapped to a
`Partial<TaxTip>`: when `serviceChargeCents` is present, set `serviceCents` with
`serviceIsPercent: false`, and additionally set `tipCents: 0, tipPercent: 0`.

**Guard:** zero the tip only when the receipt did *not* also report an explicit tip. If a
receipt carries both a service charge and a tip line, the detected tip wins and nothing is
zeroed.

## Backward compatibility

Every receipt written before this change has a `taxTip` map without the three new keys, so
`serviceCents` reads back `undefined` and `subtotal + tax + tip + undefined` is `NaN` —
which would corrupt every total on every existing receipt, not just ones with a fee.

Normalize at the Firestore read boundary in `src/hooks/useFirestoreReceipt.ts`, per
`docs/conventions/general.md` ("Validate at boundaries"):

```ts
taxTip: { ...initialTaxTip, ...data.taxTip }
```

No migration, no write-on-read. `fsSetTaxTip` already merges into the existing map, so
partial updates keep working unchanged.

## UI and outputs

- **`TotalsSection`** — a `SERVICE` row between `TAX` and `TIP`, reusing `EditableTaxTipRow`
  unchanged with its `%`/currency toggle and presets. Preset percentages:
  `[10, 12.5, 15, 18]`. Visibility, stated precisely because the two modes differ:
  - **Editable mode** (`onChange` provided): always rendered, so a charge can be discovered
    and added by hand. When the effective amount is zero it additionally carries the
    existing `no-print` class, so a printout never shows a `SERVICE $0.00` line.
  - **Read-only mode** (`onChange` absent): rendered only when the effective amount is
    non-zero, matching how `SplitSection` already gates on `> 0`.
- **`SplitSection`** — a Service line per person, following the existing
  `serviceShareCents > 0 &&` pattern.
- **`format.ts`** — a Service line in the share text and a Service row in the CSV, matching
  how Tax and Tip are already emitted and omitted when zero.

A *detected* charge is a fixed amount, so the row reads `SERVICE ··· $25.67` with no
percentage — consistent with how detected tax and tip already set `isPercent: false`.
`SERVICE (18%)` appears only if a user switches that row to percent mode.

## Testing

TDD throughout: test first, watched to fail, then minimal implementation.

**`calculator.test.ts`**
- service charge distributed proportionally across people
- shares sum exactly to the effective service charge (remainder to last person)
- zero service charge changes no total (the non-regression invariant)
- percent mode computes from the subtotal
- a legacy `taxTip` lacking service keys does not produce `NaN`

**`receiptExtraction.test.ts`**
- valid `serviceChargeCents` is parsed and rounded
- negative, non-numeric, and absent values become `null`

**`format.test.ts`**
- Service appears in share text and CSV when non-zero, and is omitted when zero

**End-to-end**
- Generate a receipt image containing a `SERVICE CHARGE` line, POST it to `/api/ocr`, and
  confirm the charge is captured and the tip comes back zeroed
- Generate one with no service charge and confirm output is unchanged from today

Full suite, `tsc --noEmit`, and production build must all be clean.

## Out of scope

- Splitting a service charge unevenly, or exempting a person from it
- Per-fee breakdown when a receipt lists several distinct fees (they are summed)
- Applying tax on top of the service charge
- Retroactively fixing receipts already created with a phantom 20% tip
