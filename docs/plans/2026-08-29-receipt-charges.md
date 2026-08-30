# Generic Receipt Charges — Implementation Plan

**Goal:** Replace the fixed tax/tip/service field triplets with a generic `{label, amountCents}` charge list parsed as cash, keeping tip as the only special case.

**Architecture:** `ReceiptDoc.taxTip` becomes `charges: ReceiptCharge[]` + `tip: Tip`. Charges are cash-only and distributed proportionally, one at a time, through the existing `distributeProportionally` helper. Legacy documents convert at the Firestore read boundary; writes self-heal. Tip keeps percent mode and its 20% default, with no suppression logic.

**Tech Stack:** Next.js 16 (App Router), TypeScript, Firebase Firestore, Tailwind CSS 4, Vitest 4.

**Spec:** `docs/plans/2026-08-29-receipt-charges-design.md`

**Execution:** inline in the main session, TDD per task, one commit per task.

## Global Constraints

- All money in integer cents. Display via `formatMoney(cents, currency)`; CSV uses `formatMoneyRaw`.
- Reuse `distributeProportionally` (last-person-remainder). Do not write a second splitter.
- Charges have **no percent mode**. Only `Tip` does.
- A charge amount may be **negative** — a discount is a real receipt line — and is bounded in both directions by `isValidChargeAmount`.
- Tip is computed on the **subtotal only** — never on subtotal-plus-charges.
- A malformed charge is dropped and the scan still succeeds; only unusable **items** make a scan `partial`. (This reverses the original plan: `partial` is unrecoverable, so one bad charge line made a receipt permanently unscannable. See the design doc's Validation section.)
- Zero-amount charges are not stored.
- `docs/conventions/general.md`: validate at boundaries; name magic numbers; no test-only exports.
- `docs/conventions/firestore.md`: `runTransaction` for read-modify-write; surface mutation errors.
- Vitest runs in the `node` environment — React components and hooks cannot be unit-tested. Logic needing tests lives in `src/lib/`.
- Suite is currently 92 tests, green. Keep it green at every commit.

## File map

| File | Change |
| --- | --- |
| `src/types/index.ts` | add `ReceiptCharge`, `Tip`, `initialTip`; `ReceiptDoc.charges`/`.tip`; `PersonBreakdown.chargeShares`; delete `TaxTip`, `initialTaxTip` |
| `src/lib/calculator.ts` | add `getChargesTotalCents`, rewrite `calculateBreakdowns`, retype `getEffectiveTipCents`; delete tax/service getters |
| `src/lib/charges.ts` | **new** — `normalizeReceiptMoney`, `chargesFromExtraction`, `makeChargeId` (replaces `src/lib/taxTip.ts`) |
| `src/lib/receiptExtraction.ts` | parse/validate `charges[]`; drop malformed ones without failing the scan |
| `src/app/api/ocr/route.ts` | prompt schema + rules; response passthrough |
| `src/lib/ocr.ts` | `OcrResult.charges` |
| `src/lib/firestore.ts` | `fsAddCharge`/`fsUpdateCharge`/`fsDeleteCharge`/`fsSetTip`; `createReceipt` normalizes; delete `fsSetTaxTip` |
| `src/hooks/useFirestoreReceipt.ts` | normalize on read; expose charge/tip mutations |
| `src/components/receipt/ScanSection.tsx` | map extraction → charges + tip |
| `src/components/receipt/TotalsSection.tsx` | charge rows + tip row |
| `src/components/receipt/SplitSection.tsx` | per-charge shares |
| `src/lib/format.ts` | charge rows in share text + CSV |
| `src/app/page.tsx`, `src/app/receipt/[id]/ReceiptPageClient.tsx` | wiring |

---

## Task 1 — Data model and split math

**Files:** `src/types/index.ts`, `src/lib/calculator.ts`, `src/lib/__tests__/calculator.test.ts`

**Produces:** `ReceiptCharge`, `Tip`, `initialTip`, `PersonBreakdown.chargeShares`, `getChargesTotalCents(charges)`, `getEffectiveTipCents(tip, subtotalCents)`.

- [ ] Add `ReceiptCharge`, `Tip`, `initialTip` to types; add `charges`/`tip` to `ReceiptDoc`; add `chargeShares` to `PersonBreakdown`; delete `TaxTip`, `initialTaxTip`, `taxShareCents`, `serviceShareCents`.
- [ ] Run `npx tsc --noEmit` — expect widespread failures. That list is the work queue for tasks 1–4; it is expected, not a problem.
- [ ] Write failing calculator tests:
  - each charge distributed proportionally to person subtotals
  - each charge's shares sum exactly to that charge (3-person remainder case)
  - `chargeShares` carries `chargeId` and `label`
  - `totalCents` = subtotal + all charge shares + tip share
  - empty `charges` → no shares, totals unchanged (non-regression)
  - percent tip computed on subtotal only, **not** subtotal + charges (guard against compounding)
  - `getChargesTotalCents` sums; `[]` → 0
- [ ] Run tests, confirm they fail for the right reason.
- [ ] Implement `getChargesTotalCents`; retype `getEffectiveTipCents(tip: Tip, ...)`; rewrite `calculateBreakdowns` to loop charges, calling `distributeProportionally` per charge; delete `getEffectiveTaxCents`/`getEffectiveServiceCents`.
- [ ] Tests pass. Commit: `feat: model receipt charges as a generic cash list`.

## Task 2 — Extraction

**Files:** `src/lib/receiptExtraction.ts`, `src/app/api/ocr/route.ts`, `src/lib/ocr.ts`, `src/lib/__tests__/receiptExtraction.test.ts`

**Consumes:** `ReceiptCharge` (task 1). **Produces:** `ExtractedReceipt.charges: {label, amountCents}[]`, same on `OcrResult`.

Orientation — do not disturb: `ExtractionFailureCode` has five members; `extractJson()` handles fences and surrounding prose; `parseAndValidate` returns `ParseResult {receipt, dropped}`; a non-array `items` throws deliberately.

- [ ] Write failing tests: charges parsed with labels verbatim; label trimmed; a malformed charge (missing label, non-numeric amount, out-of-bound magnitude) is dropped while the scan succeeds; an unusable item still yields `partial`; a negative amount is kept; zero-amount charge omitted from the result; absent `charges` key → `[]`; non-array `charges` → `[]` without throwing.
- [ ] Run, confirm failures.
- [ ] Add `charges` to `ExtractedReceipt`; validate in `parseAndValidate`, dropping malformed charges without adding them to `dropped` (only items feed `partial`).
- [ ] Update `EXTRACTION_PROMPT`: replace `taxCents`/`serviceChargeCents` in the schema with `"charges": [ { "label": "string", "amountCents": number } ]`; keep `tipCents`. Rules per spec — any non-item line that *changes* the total; label verbatim; discounts and comps as negative amounts; a diner-chosen tip goes to `tipCents`; exclude subtotal/total/payment lines. Remove the enumerated fee vocabulary.
- [ ] Pass `charges` through the route response and into `OcrResult`.
- [ ] Full suite green, `tsc` may still fail on untouched UI. Commit: `feat: extract receipt charges as labelled cash lines`.

## Task 3 — Migration, Firestore, and scan wiring

**Files:** `src/lib/charges.ts` (new), `src/lib/__tests__/charges.test.ts` (new), delete `src/lib/taxTip.ts` + its test, `src/lib/firestore.ts`, `src/hooks/useFirestoreReceipt.ts`, `src/components/receipt/ScanSection.tsx`, `src/app/page.tsx`

**Produces:** `normalizeReceiptMoney(raw, items)`, `chargesFromExtraction(result)`, `makeChargeId(label, index)`.

- [ ] Write failing tests in `charges.test.ts`:
  - new-shape doc passes through unchanged
  - legacy cash tax → `{label: "Tax"}` charge with the same cents
  - legacy percent tax → cash computed from the items' subtotal, exact
  - legacy `serviceCents` → `{label: "Service Charge"}` charge
  - legacy tip carried over with `isPercent`/`percent` intact
  - zero-valued legacy tax and service produce **no** charge
  - absent/null map → `{charges: [], tip: initialTip}`
  - charge ids stable across two calls on the same input
  - `chargesFromExtraction`: charges mapped with ids; parsed tip → fixed cash; no tip → tip untouched (**no zeroing under any input**)
- [ ] Run, confirm failures (module missing).
- [ ] Implement `src/lib/charges.ts`; delete `src/lib/taxTip.ts` and `taxTip.test.ts`.
- [ ] `firestore.ts`: `createReceipt` normalizes; add `fsAddCharge`, `fsUpdateCharge`, `fsDeleteCharge` (all `runTransaction`), `fsSetTip` (`updateDoc`); delete `fsSetTaxTip`.
- [ ] `useFirestoreReceipt`: `normalizeReceiptMoney(data?.taxTip ?? data, items)` on read; expose `addCharge`/`updateCharge`/`deleteCharge`/`setTip` with the existing optimistic-update pattern; drop `setTaxTip`.
- [ ] `ScanSection` uses `chargesFromExtraction`; `page.tsx` drops its now-redundant `initialTaxTip` spread.
- [ ] Suite green. Commit: `feat: migrate legacy tax/tip/service to charges at the read boundary`.

## Task 4 — UI and exports

**Files:** `src/components/receipt/TotalsSection.tsx`, `src/components/receipt/SplitSection.tsx`, `src/lib/format.ts`, `src/lib/__tests__/format.test.ts`, `src/app/receipt/[id]/ReceiptPageClient.tsx`

- [ ] Write failing `format.test.ts` tests: **byte-identity baseline** for share text and CSV with no charges, derived by running the current implementation (this pins the non-regression invariant); one row per charge when charges exist, labelled as parsed; grand total includes all charges in **both** `generateShareText` and `generateCsv`.
- [ ] Run, confirm failures. After implementing, prove the baseline bites: perturb one line (e.g. `"─".repeat(30)` → `29`), confirm failure, revert.
- [ ] `format.ts`: emit a row per charge between Subtotal and Tip in both functions; totals include charges.
- [ ] `TotalsSection`: replace the three `EditableTaxTipRow`s with a mapped list of cash-only charge rows (label + amount, editable, deletable), an add-charge affordance, then the TIP row keeping its toggle and 15/18/20/25 presets. Delete `TAX_PRESETS`/`SERVICE_PRESETS`.
- [ ] `SplitSection`: render one line per `chargeShares` entry, gated `> 0`, before the tip line.
- [ ] `ReceiptPageClient`: pass `charges`/`tip` and the new mutations.
- [ ] `npm test`, `npx tsc --noEmit`, `npm run build` all clean; `npx eslint src` still exactly 8 pre-existing errors. Commit: `feat: show receipt charges in totals, split, and exports`.

## Task 5 — End-to-end verification

- [ ] Build, start on a free port, POST a generated receipt image with `TAX` and `SERVICE CHARGE 18%` lines to `/api/ocr`; confirm both come back as labelled charges with correct cents and `tipCents: null`.
- [ ] POST a receipt with tax only; confirm one charge and no invented fees.
- [ ] Confirm the tip is **never** auto-zeroed in either response path.
- [ ] Stop the server (`pkill -f "next-server"` — `"next start"` matches nothing).
- [ ] Final: `npm test`, `npx tsc --noEmit`, `npm run build`, eslint count 8, `git status --short` empty.
- [ ] Push branch and open a PR. Do not merge.

## Verification checklist

- [ ] Adding a fee category requires no code change
- [ ] Charges are cash-only; only `Tip` has percent mode
- [ ] Per-charge shares sum exactly to each charge
- [ ] Tip computed on subtotal only, never compounding on charges
- [ ] No tip-zeroing logic exists anywhere
- [ ] Malformed charge dropped with the scan intact; unusable item still `partial`
- [ ] Negative charges supported end to end: prompt, parser, bound, input, split, exports
- [ ] Zero-amount charges not stored; no `$0.00` rows
- [ ] Legacy docs convert exactly; percent tax freezes to cash; writes self-heal
- [ ] No-charges output byte-identical to before, pinned by a test proven to fail on a one-character change
