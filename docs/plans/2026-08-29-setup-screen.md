# Setup Screen — Implementation Plan

**Goal:** A step between creating a shplit and the receipt page that collects who was at the meal and whether a tip is being added that isn't on the bill.

**Architecture:** `src/app/page.tsx` becomes a small state machine (`idle → setup → creating`) holding the in-flight scan promise in a ref, so the scan runs while the user fills the form. The two decisions — names to people, and which tip wins — live as pure functions in `src/lib/setup.ts` so they can be tested; the component is presentation only.

**Spec:** `docs/plans/2026-08-29-setup-screen-design.md`

**Execution:** inline, TDD per task, one commit per task.

## Global Constraints

- All money in integer cents. Tip percentages are whole or one-decimal numbers, as today.
- Vitest runs in the `node` environment — components and hooks cannot be unit-tested. Logic needing tests lives in `src/lib/`.
- `docs/conventions/general.md`: validate at boundaries; name magic numbers; **no test-only exports**.
- `docs/conventions/react-patterns.md`: inputs backed by remote state keep local state while focused. (Setup inputs are local-only until Continue, so this does not apply to them.)
- Suite is 123 tests, green. Keep it green at every commit.
- `npx eslint src` reports 8 pre-existing errors. Do not add to that count.
- **Tip resolution is the asymmetric table in the spec.** An active choice overrides the bill; unchecked does not.

## File map

| File | Change |
| --- | --- |
| `src/lib/setup.ts` | **new** — `buildInitialPeople`, `resolveInitialTip`, `SetupTipAnswer` |
| `src/lib/__tests__/setup.test.ts` | **new** |
| `src/lib/charges.ts` | `chargesFromExtraction` returns charges only; tip resolution moves to `setup.ts` |
| `src/components/receipt/ScanSection.tsx` | `ScanResult` carries `parsedTipCents` instead of a resolved `tip`; new `onScanStarted` callback |
| `src/components/receipt/SetupSection.tsx` | **new** — presentation only |
| `src/app/page.tsx` | step state machine, scan promise ref, wiring |

---

## Task 1 — Pure logic

**Files:** `src/lib/setup.ts`, `src/lib/__tests__/setup.test.ts`

- [ ] Write failing tests:
  - `buildInitialPeople`: trims names; drops blank and whitespace-only entries; `[]` → `[]`; assigns distinct ids; cycles `PERSON_COLORS` so index 0 and index `PERSON_COLORS.length` share a colour; allows two people with the same name
  - `resolveInitialTip`, all four cells: checked+printed → percent; checked+none → percent; unchecked+printed → the printed cash tip; unchecked+none → `$0.00`
  - `resolveInitialTip` with `parsedTipCents: 0` — a printed `$0.00` tip is still printed, and must not be treated as absent
- [ ] Run, confirm failures (module missing).
- [ ] Implement. `resolveInitialTip` returns a `Tip`; the unchecked-with-no-bill case is `{ cents: 0, isPercent: false, percent: initialTip.percent }` so the row reads `$0.00` while a later toggle to `%` still offers the 20 default.
- [ ] Commit: `feat: add setup-step people and tip resolution`.

## Task 2 — Expose the raw parsed tip

**Files:** `src/lib/charges.ts`, `src/lib/__tests__/charges.test.ts`, `src/components/receipt/ScanSection.tsx`

Rationale: `chargesFromExtraction` currently maps `tipCents` into a `Tip`. `resolveInitialTip` now owns that decision, so two places would otherwise decide the tip. Confirm `chargesFromExtraction` has no other caller before changing its shape.

- [ ] Update the `chargesFromExtraction` tests: it returns `ReceiptCharge[]` (or `null` when the receipt reported nothing), with no `tip`. Delete the tip-specific cases, keeping the one that pins **no tip-zeroing under any input** — retarget it at `resolveInitialTip`.
- [ ] Run, confirm failures.
- [ ] Change `chargesFromExtraction` to return `ReceiptCharge[] | null`.
- [ ] `ScanResult`: replace `tip?: Tip` with `parsedTipCents: number | null`; populate from `result.tipCents`.
- [ ] Commit: `refactor: give the scan result the raw parsed tip`.

## Task 3 — SetupSection

**Files:** `src/components/receipt/SetupSection.tsx`

Presentation only — all state lifted to `page.tsx`. Follow the receipt-tape style of `PeopleSection` and `TotalsSection`: `Section` wrapper, `font-receipt` labels, `font-hand` for names, dot-leader rows where a label pairs with a value.

- [ ] Props: `names: string[]`, `onChangeNames`, `tipEnabled: boolean`, `onToggleTip`, `tipPercent: number`, `onChangeTipPercent`, `onContinue`, `isBusy: boolean`, `scanError: string | null`, `onRetake`.
- [ ] Blocks: a "who was there" list of name inputs with add/remove; a "tip not on the bill" checkbox that reveals a percent field with the `TIP_PRESETS` values `[15, 18, 20, 25]` when checked; a Continue button.
- [ ] When `scanError` is set, render it with a Retake action instead of Continue — a user must not be able to continue against a scan that already failed.
- [ ] Continue stays enabled with zero names; it shows a busy state while the scan is still in flight.
- [ ] Verify `npx tsc --noEmit` and that eslint errors stay at 8.
- [ ] Commit: `feat: add the setup step component`.

## Task 4 — Wire the flow

**Files:** `src/app/page.tsx`, `src/components/receipt/ScanSection.tsx`

- [ ] `ScanSection` gains `onScanStarted(promise, imageDataUrl)`, fired as soon as a photo is captured, handing the in-flight promise up. It keeps its own capture UI; progress UI is no longer reached on this path.
- [ ] `page.tsx` holds `step: "idle" | "setup" | "creating"`, the scan promise in a ref, and the setup form state. On Continue: await the promise (already resolved in the common case), build `people` via `buildInitialPeople`, resolve the tip via `resolveInitialTip(answer, parsedTipCents)`, then `createReceipt` and push.
- [ ] Manual path enters the same step, keeps its placeholder item, and passes `parsedTipCents: null`.
- [ ] A rejected or failed scan surfaces on the setup step via `scanError`; Retake returns to `idle`.
- [ ] Verify `npm test`, `npx tsc --noEmit`, `npm run build`, eslint still 8.
- [ ] Commit: `feat: collect people and tip before opening a receipt`.

## Task 5 — Verification

- [ ] Build, start on a free port, and exercise `/api/ocr` to confirm the scan path still returns items, charges, and `tipCents` unchanged by this work.
- [ ] Confirm by reading `page.tsx` that the four tip cells route correctly, and that zero names produces `people: []` rather than a person with an empty name.
- [ ] Stop the server (`pkill -f "next-server"`).
- [ ] Final: `npm test`, `npx tsc --noEmit`, `npm run build`, eslint 8, `git status --short` empty.
- [ ] Push and open a PR. Do not merge.

## Verification checklist

- [ ] Setup step renders immediately on the scan path, with the scan running behind it
- [ ] Checked overrides a printed tip; unchecked never discards one
- [ ] Unchecked with no printed tip yields `$0.00`, not the old silent 20%
- [ ] Continue works with zero people
- [ ] A failed scan cannot be continued past
- [ ] Tip is decided in exactly one place (`resolveInitialTip`)
