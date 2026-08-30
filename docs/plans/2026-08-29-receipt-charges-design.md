# Generic Receipt Charges — Design

**Date:** 2026-08-29
**Status:** Approved
**Supersedes:** PR #8 (`feat/service-charge`), closed unmerged

## Problem

Users reported that a service charge on a receipt wasn't accounted for: it was discarded, so
the app's total came out below the printed total and the difference was split by nobody.

PR #8 fixed that by adding a third fixed field group — `serviceCents`, `serviceIsPercent`,
`servicePercent` — beside the existing tax and tip groups. That approach does not scale. Every
new fee category costs a triplet in `TaxTip`, a bucket in the extraction prompt, a branch in the
calculator, a row in two components, and a column in two exporters. Receipts carry an open-ended
set of fees — delivery, bag, kitchen, wellness, health surcharge, large-party — under wording that
varies by venue, region, and language. Enumerating them in code is a losing race.

Review of PR #8 also found two bugs, both in the tip-zeroing rule it introduced:

- `serviceChargeCents: 0` passed validation as `0` rather than `null`, so a zero-value charge
  wiped the 20% tip default — invisibly, because a zero charge renders no SERVICE row
- the rule keyed on any fee in the bucket, so a $0.10 bag fee suppressed the tip

## Approach

Model every non-item monetary line as a generic charge parsed as cash. Tip is the only special
case, because it is the one line a diner adds after the receipt prints.

**Tip-zeroing is dropped, not fixed.** It was the source of both bugs, and the complexity needed
to make it correct — gratuity detection by label, by ratio, or by an extra model field — is not
worth it. Tip always prefills 20%. On a receipt that already carries an auto-gratuity, that
overshoots the printed total until someone edits the tip. That case is visible (both rows render)
and one tap to correct, so it fails in the noticeable direction.

## Data model

`src/types/index.ts`:

```ts
export interface ReceiptCharge {
  /** Stable id, for editing and deletion */
  id: string;
  /** Label as printed on the receipt, e.g. "Tax", "Service Charge", "Bag Fee" */
  label: string;
  /** Amount in cents. Always cash — charges have no percent mode. */
  amountCents: number;
}

export interface Tip {
  /** Tip amount in cents (used when isPercent is false) */
  cents: number;
  /** Whether the tip is expressed as a percentage */
  isPercent: boolean;
  /** Tip percentage (used when isPercent is true) */
  percent: number;
}

export const initialTip: Tip = { cents: 0, isPercent: true, percent: 20 };
```

`ReceiptDoc.taxTip: TaxTip` is replaced by `charges: ReceiptCharge[]` and `tip: Tip`. `TaxTip`
and `initialTaxTip` are deleted.

Tax is an ordinary charge. It loses percent mode and its 5/7/8/10 presets, and with them the
current `taxIsPercent: true, taxPercent: 7` default — so a receipt with no tax line no longer
receives a phantom 7% tax.

`PersonBreakdown` gains `chargeShares: { chargeId: string; label: string; shareCents: number }[]`
and keeps `tipShareCents`. `taxShareCents` and `serviceShareCents` are removed.

## Extraction

The prompt returns charges as a list and the tip separately:

```json
{
  "restaurantName": "string or null",
  "items": [ { "name": "string", "quantity": number, "priceCents": number } ],
  "charges": [ { "label": "string", "amountCents": number } ],
  "tipCents": number or null,
  "currency": "ISO 4217 code"
}
```

Rules:

- A charge is any non-item monetary line that **changes the total**: tax, service charge, service
  fee, delivery fee, bag fee, surcharges, auto-gratuity, and discounts or comps (negative).
- `label` is copied verbatim from the receipt, trimmed, with surrounding punctuation removed.
  A printed percentage stays in the label (`"Service Charge 18%"`) — it is not parsed out.
- `amountCents` is the charge's cash amount in integer cents. It is **negative** for
  anything that reduces the total — a discount, promotion, or comp. A discount is a real
  receipt line, and omitting it would make the app's total exceed the printed total.
  Magnitudes are bounded in both directions so a corrupt value cannot drive the grand
  total below zero.
- Exclude subtotal, total, payment-method lines, dates, addresses, phone numbers.
- A diner-chosen tip or gratuity line goes in `tipCents`, not in `charges`.
- No charges found → empty array.

No fee vocabulary is enumerated in code, so a new wording needs no change anywhere.

**Validation.** Each charge needs a non-empty string `label` and a finite `amountCents` within
the magnitude bound. A charge failing validation is **dropped, and the scan still succeeds.**

This reverses an earlier decision in this document, which made a bad charge fail the scan as
`partial` on the grounds that silently dropping one undercounts the total. Review showed that
trade to be the wrong way round: `partial` is unrecoverable — the same photo reproduces it on
every retry — so one malformed charge line made a receipt *permanently unscannable*, while a
missing charge is visible in the totals and can be re-added by hand. Unusable **items** still
fail the scan hard, because a receipt missing dishes cannot be split at all.

Known gap: a dropped charge currently produces no user-visible signal. Closing it properly needs
a "succeeded with warnings" state, which the five-code failure taxonomy has no room for.

Zero-amount charges are valid input but are not stored: they add nothing and would render a
`$0.00` row.

## Split math

`src/lib/calculator.ts`:

- `getChargesTotalCents(charges)` — sum of `amountCents`
- `calculateBreakdowns` distributes **each charge separately** through the existing
  `distributeProportionally` helper (last-person-remainder), so every charge's shares sum exactly
  to that charge
- `getEffectiveTipCents(tip, subtotalCents)` keeps today's behavior: percent of subtotal, or cash

Per-person totals are `subtotal + sum(chargeShares) + tipShare`.

**Tip is computed on the subtotal only**, never on subtotal-plus-charges. A percentage tip
compounding on a service charge would inflate the bill.

**Decision — per-charge breakdown lines.** Each person's breakdown lists one line per charge
rather than a single lumped "charges" figure. It mirrors the receipt, and a lumped number cannot
be reconciled against the printed lines. Cost: a receipt with several fees produces several lines
per person.

## Backward compatibility

Every stored receipt has `taxTip` and no `charges`/`tip`. Convert at the Firestore read boundary
in `src/hooks/useFirestoreReceipt.ts`, per `docs/conventions/general.md` ("Validate at
boundaries"). No migration job, no write on read.

`normalizeReceiptMoney(raw, items)` returns `{ charges, tip }`:

| Stored | Becomes |
| --- | --- |
| `charges` + `tip` present | kept, with any malformed charge **dropped** (a charge is not repairable — an unparseable amount has no safe default) |
| `taxTip.taxCents > 0` (cash mode) | a charge `{ label: "Tax", amountCents: taxCents }` |
| `taxTip.taxIsPercent` with `taxPercent > 0` | a charge `{ label: "Tax", amountCents: round(subtotal × taxPercent / 100) }` |
| `taxTip.serviceCents > 0` | a charge `{ label: "Service Charge", amountCents: serviceCents }` |
| `taxTip.tip*` | `{ cents, isPercent, percent }`, carried over unchanged |
| neither present | `{ charges: [], tip: initialTip }` |

Zero-valued legacy tax and service produce no charge, so migrated receipts don't sprout `$0.00`
rows. Charge ids are minted deterministically from the label at migration (`charge-tax`,
`charge-service`) so a re-read doesn't churn ids.

**Decision — percent tax freezes on migration.** A legacy percent-mode tax needs the subtotal to
become cash, which is computable exactly from the stored items. But it then stops rescaling:
today, editing an item's price re-derives a 7% tax; after migration the amount is fixed. This is
the new model's intent — the tax printed on a receipt does not change because a typo was
corrected — but it is a visible behavior change on receipts currently in use, and is called out
here for that reason.

`fsSetTaxTip` is replaced by `fsAddCharge`, `fsUpdateCharge`, `fsDeleteCharge`, and `fsSetTip`.
Read-modify-write paths use `runTransaction` per `docs/conventions/firestore.md`. Each write
normalizes first, so a touched legacy document self-heals into the new shape.

## UI and exports

- **`TotalsSection`** — SUBTOTAL, then one row per charge, then the TIP row, then TOTAL. Charge
  rows are cash-only: label plus amount, editable in place, with delete. An "add charge" affordance
  covers manual-entry receipts and anything OCR missed. TIP keeps its percent/cash toggle and its
  15/18/20/25 presets. Charge order follows the receipt.
- **`SplitSection`** — under each person: their items, one line per charge share, then their tip
  share. Existing `> 0` gating is preserved so zero rows stay hidden.
- **`format.ts`** — share text and CSV each emit one row per charge, labelled as parsed, between
  Subtotal and Tip.

Because charge rows have no percent mode, the row component is simpler than the current
`EditableTaxTipRow`, which exists to manage that toggle.

## Testing

TDD throughout: test first, watched to fail, then implementation.

- **calculator** — per-charge proportional distribution; shares sum exactly per charge
  (remainder to last person); zero charges changes nothing; tip computed on subtotal only, never
  compounding on charges; empty charge list
- **extraction** — charges parsed with labels preserved verbatim; a malformed charge is dropped
  while the scan succeeds; an unusable item still yields `partial`; a negative amount is kept; an
  out-of-bound magnitude is rejected; zero-amount charge not stored; absent `charges` key → `[]`
- **currency input** — `parseCurrencyInput` accepts a negative only when the field opts in, so a
  discount can be typed and corrected while a negative tip still cannot
- **migration** — legacy cash tax, legacy percent tax (exact cash conversion), legacy service
  charge, legacy tip carried through, zero-valued legacy fields producing no charge, a document
  already in the new shape passing through unchanged, and a null/absent map yielding defaults
- **format** — byte-identity baselines for a receipt with no charges, pinning that output is
  unchanged from before this work; charge rows present when charges exist
- **end-to-end** — a receipt image with tax and a service charge returns both as labelled charges
  on a real production build

## Out of scope

- Percent mode for charges
- Gratuity detection and tip suppression in any form
- Reordering charges by hand (order follows the receipt)
- Splitting a charge unevenly or exempting a person from one
- Backfilling stored documents (conversion is read-time; writes self-heal)
