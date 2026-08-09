# Service Charge Support Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Capture a receipt's service charge and split it across people, instead of silently discarding it.

**Architecture:** A third `SERVICE` amount joins tax and tip in the `TaxTip` model, distributed proportionally by the existing `distributeProportionally` helper. The OCR prompt gains a `serviceChargeCents` capture field to match the exclusion rule it already has. A new `src/lib/taxTip.ts` holds two pure functions — one deriving a `Partial<TaxTip>` from an extraction result (including the tip-zeroing rule), one normalizing a Firestore map that predates these fields — so both behaviors are unit-testable without React or network.

**Tech Stack:** Next.js 16 (App Router), TypeScript, Firebase Firestore, Tailwind CSS 4, Vitest 4.

**Spec:** `docs/superpowers/specs/2026-08-09-service-charge-design.md`

## Global Constraints

- All money is integer cents. Display via `formatMoney(cents, currency)` from `src/lib/currency.ts`.
- Proportional distribution uses last-person-gets-remainder so shares sum exactly. Reuse `distributeProportionally` in `src/lib/calculator.ts`; do not write a second splitter.
- `docs/conventions/general.md`: **no test-only exports.** If something needs testing, it belongs in a real module with a real consumer.
- `docs/conventions/general.md`: magic numbers get a name and a comment explaining the choice.
- `docs/conventions/general.md`: validate data from APIs and `JSON.parse` at the boundary.
- Vitest runs in the `node` environment (`vitest.config.ts`). There is no jsdom and no React Testing Library, so **React components cannot be unit-tested.** Logic that needs testing must live in `src/lib/`.
- Run the full suite with `npm test`. Typecheck with `npx tsc --noEmit`.
- Row order is **TAX, SERVICE, TIP** everywhere it appears: totals, per-person breakdown, share text, CSV.
- **Non-regression invariant:** with no service charge, every existing output must be byte-identical to today.

---

### Task 1: Data model and split math

**Files:**
- Modify: `src/types/index.ts` (`TaxTip`, `initialTaxTip`, `PersonBreakdown`)
- Modify: `src/lib/calculator.ts`
- Test: `src/lib/__tests__/calculator.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `TaxTip` with `serviceCents: number`, `serviceIsPercent: boolean`, `servicePercent: number`. `PersonBreakdown` with `serviceShareCents: number`. `getEffectiveServiceCents(taxTip: TaxTip, subtotalCents: number): number` exported from `src/lib/calculator.ts`.

- [ ] **Step 1: Add the three fields to `TaxTip` and `initialTaxTip`**

In `src/types/index.ts`, append to the `TaxTip` interface, after `tipPercent`:

```ts
  /** Service charge amount in cents */
  serviceCents: number;
  /** Whether the service charge is expressed as a percentage */
  serviceIsPercent: boolean;
  /** Service charge percentage (used when serviceIsPercent is true) */
  servicePercent: number;
```

Append to `initialTaxTip`, after `tipPercent: 20,`:

```ts
  // Default off, unlike tax and tip: most receipts carry no service charge, and
  // a detected one arrives as a fixed amount. The 18 is only the starting value
  // if a user switches this row to percent mode by hand.
  serviceCents: 0,
  serviceIsPercent: false,
  servicePercent: 18,
```

Append to the `PersonBreakdown` interface, after `taxShareCents`:

```ts
  serviceShareCents: number;
```

- [ ] **Step 2: Run typecheck to see the expected breakage**

Run: `npx tsc --noEmit`

Expected: FAIL. `src/lib/__tests__/calculator.test.ts` declares `defaultTaxTip` as a full `TaxTip` literal, now missing three properties, and `src/lib/calculator.ts` builds `PersonBreakdown` objects without `serviceShareCents`. These are the call sites Task 1 fixes.

- [ ] **Step 3: Write the failing tests**

In `src/lib/__tests__/calculator.test.ts`, add the three new fields to the existing `defaultTaxTip` fixture:

```ts
const defaultTaxTip: TaxTip = {
  taxCents: 0,
  taxIsPercent: false,
  taxPercent: 0,
  tipCents: 0,
  tipIsPercent: false,
  tipPercent: 0,
  serviceCents: 0,
  serviceIsPercent: false,
  servicePercent: 0,
};
```

Add `getEffectiveServiceCents` to the import list from `../calculator`. Then append these suites:

```ts
describe("getEffectiveServiceCents", () => {
  it("returns the fixed amount when not in percent mode", () => {
    const taxTip = { ...defaultTaxTip, serviceCents: 2567 };
    expect(getEffectiveServiceCents(taxTip, 14260)).toBe(2567);
  });

  it("computes from the subtotal when in percent mode", () => {
    const taxTip = { ...defaultTaxTip, serviceIsPercent: true, servicePercent: 18 };
    // 14260 * 0.18 = 2566.8, rounds to 2567
    expect(getEffectiveServiceCents(taxTip, 14260)).toBe(2567);
  });

  it("treats a legacy taxTip with no service keys as zero", () => {
    // Receipts created before this feature have a taxTip map without the three
    // service keys. Reading them must not yield NaN.
    const legacy = {
      taxCents: 0,
      taxIsPercent: false,
      taxPercent: 0,
      tipCents: 0,
      tipIsPercent: false,
      tipPercent: 0,
    } as unknown as TaxTip;
    expect(getEffectiveServiceCents(legacy, 14260)).toBe(0);
  });
});

describe("calculateBreakdowns with a service charge", () => {
  it("distributes the service charge proportionally to subtotals", () => {
    const items = [makeItem("a", 6000, ["p1"]), makeItem("b", 4000, ["p2"])];
    const people = [makePerson("p1"), makePerson("p2")];
    const taxTip = { ...defaultTaxTip, serviceCents: 1000 };

    const [b1, b2] = calculateBreakdowns(items, people, taxTip);

    expect(b1.serviceShareCents).toBe(600);
    expect(b2.serviceShareCents).toBe(400);
  });

  it("includes the service share in each person's total", () => {
    const items = [makeItem("a", 6000, ["p1"]), makeItem("b", 4000, ["p2"])];
    const people = [makePerson("p1"), makePerson("p2")];
    const taxTip = { ...defaultTaxTip, serviceCents: 1000 };

    const [b1, b2] = calculateBreakdowns(items, people, taxTip);

    expect(b1.totalCents).toBe(6600);
    expect(b2.totalCents).toBe(4400);
  });

  it("gives the remainder to the last person so shares sum exactly", () => {
    const items = [
      makeItem("a", 3333, ["p1"]),
      makeItem("b", 3333, ["p2"]),
      makeItem("c", 3334, ["p3"]),
    ];
    const people = [makePerson("p1"), makePerson("p2"), makePerson("p3")];
    const taxTip = { ...defaultTaxTip, serviceCents: 1000 };

    const breakdowns = calculateBreakdowns(items, people, taxTip);
    const summed = breakdowns.reduce((s, b) => s + b.serviceShareCents, 0);

    expect(summed).toBe(1000);
  });

  it("computes a percent service charge from the assigned subtotal", () => {
    const items = [makeItem("a", 10000, ["p1"])];
    const people = [makePerson("p1")];
    const taxTip = { ...defaultTaxTip, serviceIsPercent: true, servicePercent: 18 };

    const [b] = calculateBreakdowns(items, people, taxTip);

    expect(b.serviceShareCents).toBe(1800);
    expect(b.totalCents).toBe(11800);
  });

  it("changes no total when there is no service charge", () => {
    const items = [makeItem("a", 6000, ["p1"])];
    const people = [makePerson("p1")];
    const taxTip = { ...defaultTaxTip, taxCents: 500, tipCents: 1000 };

    const [b] = calculateBreakdowns(items, people, taxTip);

    expect(b.serviceShareCents).toBe(0);
    expect(b.totalCents).toBe(7500);
  });
});
```

- [ ] **Step 4: Run the tests to verify they fail**

Run: `npx vitest run src/lib/__tests__/calculator.test.ts`

Expected: FAIL — `getEffectiveServiceCents is not a function`, and the `calculateBreakdowns` cases fail on `serviceShareCents` being `undefined`.

- [ ] **Step 5: Implement `getEffectiveServiceCents`**

In `src/lib/calculator.ts`, add after `getEffectiveTipCents`:

```ts
/**
 * Calculate the effective service charge in cents.
 * If serviceIsPercent, compute from subtotal.
 *
 * Falls back to 0 rather than trusting the field to exist: receipts created
 * before service charge support have a taxTip map without these keys, and
 * undefined would propagate as NaN through every total.
 */
export function getEffectiveServiceCents(
  taxTip: TaxTip,
  subtotalCents: number
): number {
  if (taxTip.serviceIsPercent) {
    return Math.round((subtotalCents * (taxTip.servicePercent ?? 0)) / 100);
  }
  return taxTip.serviceCents ?? 0;
}
```

- [ ] **Step 6: Wire the service share into `calculateBreakdowns`**

In `src/lib/calculator.ts`, inside `calculateBreakdowns`, add `serviceShareCents: 0,` to the returned breakdown object, immediately after `taxShareCents: 0,`.

Then, after the `effectiveTipCents` line, add:

```ts
  const effectiveServiceCents = getEffectiveServiceCents(
    taxTip,
    totalPersonSubtotal
  );
```

After the `tipShares` declaration, add:

```ts
  const serviceShares = distributeProportionally(
    effectiveServiceCents,
    personSubtotals,
    totalPersonSubtotal
  );
```

Replace the assignment loop body with:

```ts
  for (let i = 0; i < breakdowns.length; i++) {
    breakdowns[i].taxShareCents = taxShares[i];
    breakdowns[i].serviceShareCents = serviceShares[i];
    breakdowns[i].tipShareCents = tipShares[i];
    breakdowns[i].totalCents =
      breakdowns[i].subtotalCents +
      taxShares[i] +
      serviceShares[i] +
      tipShares[i];
  }
```

- [ ] **Step 7: Run the tests and typecheck**

Run: `npx vitest run src/lib/__tests__/calculator.test.ts && npx tsc --noEmit`

Expected: all calculator tests PASS, tsc clean.

- [ ] **Step 8: Commit**

```bash
git add src/types/index.ts src/lib/calculator.ts src/lib/__tests__/calculator.test.ts
git commit -m "feat: model and distribute a service charge"
```

---

### Task 2: Capture the service charge from the receipt

**Files:**
- Modify: `src/lib/receiptExtraction.ts` (`ExtractedReceipt`, `parseAndValidate`)
- Modify: `src/app/api/ocr/route.ts` (`EXTRACTION_PROMPT`, final `NextResponse.json`)
- Modify: `src/lib/ocr.ts` (`OcrResult`, `recognizeImage` return)
- Test: `src/lib/__tests__/receiptExtraction.test.ts`

**Interfaces:**
- Consumes: nothing from Task 1.
- Produces: `ExtractedReceipt.serviceChargeCents: number | null`, and the same field on `OcrResult` in `src/lib/ocr.ts`. Task 3 consumes both.

**Orient yourself before editing.** `src/lib/receiptExtraction.ts` is richer than a first
read might suggest, and none of it should be disturbed by this task:
- `ExtractionFailureCode` has five members — `truncated`, `unreadable`, `empty`, `refused`,
  `partial`. Do not add or remove any.
- `extractJson()` already handles code fences case-insensitively and prose on either side.
  Leave it alone.
- `parseAndValidate` returns `ParseResult` (`{ receipt, dropped }`); `interpretExtraction`
  turns any `dropped > 0` into a `partial` failure. Your change must not alter `dropped`.
- A non-array `items` throws. That is intentional — do not convert it to an early return.

- [ ] **Step 1: Write the failing tests**

In `src/lib/__tests__/receiptExtraction.test.ts`, append:

```ts
describe("interpretExtraction service charge", () => {
  it("parses a service charge", () => {
    const result = interpretExtraction(
      "end_turn",
      '{"items":[],"serviceChargeCents":2567,"currency":"USD"}'
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.serviceChargeCents).toBe(2567);
  });

  it("rounds a fractional service charge", () => {
    const result = interpretExtraction(
      "end_turn",
      '{"items":[],"serviceChargeCents":2566.8,"currency":"USD"}'
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.serviceChargeCents).toBe(2567);
  });

  it("treats an absent service charge as null", () => {
    const result = interpretExtraction("end_turn", '{"items":[],"currency":"USD"}');

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.serviceChargeCents).toBeNull();
  });

  it("treats a negative service charge as null", () => {
    const result = interpretExtraction(
      "end_turn",
      '{"items":[],"serviceChargeCents":-500,"currency":"USD"}'
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.serviceChargeCents).toBeNull();
  });

  it("treats a non-numeric service charge as null", () => {
    const result = interpretExtraction(
      "end_turn",
      '{"items":[],"serviceChargeCents":"18%","currency":"USD"}'
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.serviceChargeCents).toBeNull();
  });

  it("captures a service charge alongside items and tax", () => {
    const result = interpretExtraction(
      "end_turn",
      '{"restaurantName":"Cafe","items":[{"name":"Latte","quantity":1,"priceCents":450}],' +
        '"taxCents":40,"serviceChargeCents":81,"currency":"USD"}'
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.items).toHaveLength(1);
    expect(result.data.taxCents).toBe(40);
    expect(result.data.serviceChargeCents).toBe(81);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/__tests__/receiptExtraction.test.ts`

Expected: FAIL — `serviceChargeCents` is `undefined`, not `2567` or `null`. TypeScript will also flag that the property does not exist on `ExtractedReceipt`.

- [ ] **Step 3: Add the field to `ExtractedReceipt` and parse it**

In `src/lib/receiptExtraction.ts`, add to the `ExtractedReceipt` interface after `tipCents`:

```ts
  serviceChargeCents: number | null;
```

Inside `parseAndValidate`, after the `currency` declaration, add:

```ts
  const serviceChargeCents =
    typeof parsed.serviceChargeCents === "number" && parsed.serviceChargeCents >= 0
      ? Math.round(parsed.serviceChargeCents)
      : null;
```

`parseAndValidate` returns a `ParseResult` wrapper (`{ receipt, dropped }`), not a bare
`ExtractedReceipt`, and it **throws** on a non-array `items` rather than returning early.
So there is exactly one place to add the field — the nested `receipt` object in the final
return, currently at `src/lib/receiptExtraction.ts:132-135`:

```ts
  return {
    receipt: {
      restaurantName,
      items,
      taxCents,
      tipCents,
      serviceChargeCents,
      currency,
    },
    dropped: parsed.items.length - items.length,
  };
```

Do not add an early return for malformed `items` — the current code throws there
deliberately, and `interpretExtraction` maps that to the `unreadable` failure.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/lib/__tests__/receiptExtraction.test.ts`

Expected: PASS, all suites in the file.

- [ ] **Step 5: Teach the prompt to capture it**

In `src/app/api/ocr/route.ts`, inside `EXTRACTION_PROMPT`, add to the JSON schema block after the `"tipCents"` line:

```
  "serviceChargeCents": number or null,
```

Then add these rules immediately after the existing `tipCents:` rule line. Leave the existing `- Exclude tax, tip, subtotal, total, discounts, service charges from items` line untouched — service charges must still stay out of `items`, they now just have somewhere to go:

```
- serviceChargeCents: mandatory fees added by the venue, in integer cents, or null if not found
- The tip/service split is mandatory vs. discretionary, not the wording: a tip or gratuity the diner chose goes in tipCents; anything auto-added by the venue goes in serviceChargeCents
- Fees that belong in serviceChargeCents: service charge, service fee, auto-gratuity, large party fee, kitchen or wellness fee, regulatory or health surcharge, delivery fee, bag fee
- If several such fees are listed, sum them into one serviceChargeCents figure
```

- [ ] **Step 6: Pass it through the route response**

In `src/app/api/ocr/route.ts`, add `serviceChargeCents: result.serviceChargeCents,` to the final success `NextResponse.json({...})`, after `tipCents`.

- [ ] **Step 7: Add it to the client result type**

In `src/lib/ocr.ts`, add to the `OcrResult` interface after `tipCents`:

```ts
  serviceChargeCents: number | null;
```

And in the object `recognizeImage` returns, after the `tipCents` line:

```ts
    serviceChargeCents:
      typeof data.serviceChargeCents === "number" ? data.serviceChargeCents : null,
```

- [ ] **Step 8: Run the full suite and typecheck**

Run: `npm test && npx tsc --noEmit`

Expected: all tests PASS, tsc clean. `src/components/receipt/ScanSection.tsx` still compiles because it does not yet read the new field.

- [ ] **Step 9: Commit**

```bash
git add src/lib/receiptExtraction.ts src/app/api/ocr/route.ts src/lib/ocr.ts src/lib/__tests__/receiptExtraction.test.ts
git commit -m "feat: capture service charge from receipt extraction"
```

---

### Task 3: Derive and normalize `TaxTip`

**Files:**
- Create: `src/lib/taxTip.ts`
- Create: `src/lib/__tests__/taxTip.test.ts`
- Modify: `src/components/receipt/ScanSection.tsx:35-40`
- Modify: `src/hooks/useFirestoreReceipt.ts:56`

**Interfaces:**
- Consumes: `TaxTip` and `initialTaxTip` from `@/types` (Task 1); `OcrResult` shape from `src/lib/ocr.ts` (Task 2).
- Produces: `normalizeTaxTip(raw: Partial<TaxTip> | null | undefined): TaxTip` and `taxTipFromExtraction(result: ExtractionTaxTipInput): Partial<TaxTip> | null`, both from `src/lib/taxTip.ts`.

**Why a new module:** the tip-zeroing rule and the legacy-doc normalization both need tests, and Vitest here runs in the `node` environment with no jsdom — so neither can be tested inside a React component or a hook. Extracting them to `src/lib/` makes them testable with real consumers, satisfying the no-test-only-exports convention.

- [ ] **Step 1: Write the failing tests**

Create `src/lib/__tests__/taxTip.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { normalizeTaxTip, taxTipFromExtraction } from "../taxTip";
import { initialTaxTip, TaxTip } from "@/types";

describe("normalizeTaxTip", () => {
  it("fills in service defaults for a legacy doc missing them", () => {
    const legacy = {
      taxCents: 800,
      taxIsPercent: false,
      taxPercent: 7,
      tipCents: 1500,
      tipIsPercent: false,
      tipPercent: 20,
    } as unknown as Partial<TaxTip>;

    const result = normalizeTaxTip(legacy);

    expect(result.serviceCents).toBe(0);
    expect(result.serviceIsPercent).toBe(false);
    expect(result.servicePercent).toBe(18);
  });

  it("preserves the stored tax and tip values", () => {
    const legacy = {
      taxCents: 800,
      taxIsPercent: false,
      taxPercent: 7,
      tipCents: 1500,
      tipIsPercent: false,
      tipPercent: 20,
    } as unknown as Partial<TaxTip>;

    const result = normalizeTaxTip(legacy);

    expect(result.taxCents).toBe(800);
    expect(result.tipCents).toBe(1500);
  });

  it("preserves a stored service charge", () => {
    const result = normalizeTaxTip({ serviceCents: 2567 });

    expect(result.serviceCents).toBe(2567);
  });

  it("returns the defaults for undefined", () => {
    expect(normalizeTaxTip(undefined)).toEqual(initialTaxTip);
  });

  it("returns the defaults for null", () => {
    expect(normalizeTaxTip(null)).toEqual(initialTaxTip);
  });
});

describe("taxTipFromExtraction", () => {
  it("returns null when nothing was detected", () => {
    const result = taxTipFromExtraction({
      taxCents: null,
      tipCents: null,
      serviceChargeCents: null,
    });

    expect(result).toBeNull();
  });

  it("maps a detected tax to a fixed amount", () => {
    const result = taxTipFromExtraction({
      taxCents: 1141,
      tipCents: null,
      serviceChargeCents: null,
    });

    expect(result).toEqual({ taxCents: 1141, taxIsPercent: false });
  });

  it("maps a detected tip to a fixed amount", () => {
    const result = taxTipFromExtraction({
      taxCents: null,
      tipCents: 2852,
      serviceChargeCents: null,
    });

    expect(result).toEqual({ tipCents: 2852, tipIsPercent: false });
  });

  it("maps a detected service charge to a fixed amount", () => {
    const result = taxTipFromExtraction({
      taxCents: null,
      tipCents: null,
      serviceChargeCents: 2567,
    });

    expect(result?.serviceCents).toBe(2567);
    expect(result?.serviceIsPercent).toBe(false);
  });

  it("zeroes the tip when a service charge is detected", () => {
    // A service charge is normally auto-gratuity, so the 20% tip default would
    // stack on top of it and overcharge by roughly 20%.
    const result = taxTipFromExtraction({
      taxCents: null,
      tipCents: null,
      serviceChargeCents: 2567,
    });

    expect(result?.tipCents).toBe(0);
    expect(result?.tipPercent).toBe(0);
    expect(result?.tipIsPercent).toBe(false);
  });

  it("keeps a detected tip when the receipt lists both", () => {
    const result = taxTipFromExtraction({
      taxCents: null,
      tipCents: 500,
      serviceChargeCents: 2567,
    });

    expect(result?.tipCents).toBe(500);
    expect(result?.tipPercent).toBeUndefined();
    expect(result?.serviceCents).toBe(2567);
  });

  it("leaves the tip untouched when no service charge is detected", () => {
    const result = taxTipFromExtraction({
      taxCents: 1141,
      tipCents: null,
      serviceChargeCents: null,
    });

    expect(result?.tipCents).toBeUndefined();
    expect(result?.tipPercent).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/__tests__/taxTip.test.ts`

Expected: FAIL with `Cannot find module '../taxTip'`.

- [ ] **Step 3: Create the module**

Create `src/lib/taxTip.ts`:

```ts
import { initialTaxTip, TaxTip } from "@/types";

/**
 * The subset of an extraction result that determines tax, tip, and service.
 */
export interface ExtractionTaxTipInput {
  taxCents: number | null;
  tipCents: number | null;
  serviceChargeCents: number | null;
}

/**
 * Fill in any TaxTip field a stored receipt is missing.
 *
 * Receipts created before service charge support have a taxTip map without the
 * three service keys. Left alone, serviceCents would read back undefined and
 * propagate as NaN through every total on the receipt, not just ones with a
 * fee. Normalizing at the Firestore read boundary avoids a migration.
 */
export function normalizeTaxTip(
  raw: Partial<TaxTip> | null | undefined
): TaxTip {
  return { ...initialTaxTip, ...(raw ?? {}) };
}

/**
 * Derive the TaxTip overrides implied by a scanned receipt, or null if the
 * receipt reported no tax, tip, or service charge at all.
 */
export function taxTipFromExtraction(
  result: ExtractionTaxTipInput
): Partial<TaxTip> | null {
  const detectedAnything =
    result.taxCents != null ||
    result.tipCents != null ||
    result.serviceChargeCents != null;
  if (!detectedAnything) return null;

  const taxTip: Partial<TaxTip> = {};

  if (result.taxCents != null) {
    taxTip.taxCents = result.taxCents;
    taxTip.taxIsPercent = false;
  }

  if (result.tipCents != null) {
    taxTip.tipCents = result.tipCents;
    taxTip.tipIsPercent = false;
  }

  if (result.serviceChargeCents != null) {
    taxTip.serviceCents = result.serviceChargeCents;
    taxTip.serviceIsPercent = false;

    // A service charge is normally auto-gratuity, so the 20% tip default would
    // double-pay. Only zero the tip when the receipt did not report one itself.
    if (result.tipCents == null) {
      taxTip.tipCents = 0;
      taxTip.tipIsPercent = false;
      taxTip.tipPercent = 0;
    }
  }

  return taxTip;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/lib/__tests__/taxTip.test.ts`

Expected: PASS, 13 tests.

- [ ] **Step 5: Use the derivation in `ScanSection`**

In `src/components/receipt/ScanSection.tsx`, add to the imports:

```ts
import { taxTipFromExtraction } from "@/lib/taxTip";
```

Replace the inline mapping block (currently lines 35-40, beginning `const taxTip: Partial<TaxTip> | null =`) with:

```ts
      const taxTip = taxTipFromExtraction(result);
```

The `TaxTip` type import on line 10 is still needed by the `ScanResult` interface, so leave it in place.

- [ ] **Step 6: Normalize at the Firestore read boundary**

In `src/hooks/useFirestoreReceipt.ts`, add to the imports:

```ts
import { normalizeTaxTip } from "@/lib/taxTip";
```

Replace line 56:

```ts
  const taxTip = data?.taxTip ?? initialTaxTip;
```

with:

```ts
  // Not `?? initialTaxTip`: a pre-service-charge doc HAS a taxTip, it is just
  // missing the service keys, so the nullish fallback never fires and the
  // missing fields would reach the calculator as undefined.
  const taxTip = normalizeTaxTip(data?.taxTip);
```

`initialTaxTip` is now unused in this file — remove it from the `@/types` import block to keep the build lint-clean.

- [ ] **Step 7: Run the full suite, typecheck, and lint**

Run: `npm test && npx tsc --noEmit && npx eslint src/lib/taxTip.ts src/hooks/useFirestoreReceipt.ts src/components/receipt/ScanSection.tsx`

Expected: all tests PASS, tsc clean, no lint output for those three files.

- [ ] **Step 8: Commit**

```bash
git add src/lib/taxTip.ts src/lib/__tests__/taxTip.test.ts src/components/receipt/ScanSection.tsx src/hooks/useFirestoreReceipt.ts
git commit -m "feat: derive service charge on scan and normalize legacy receipts"
```

---

### Task 4: Show the service charge in the UI and exports

**Files:**
- Modify: `src/components/receipt/TotalsSection.tsx`
- Modify: `src/components/receipt/SplitSection.tsx`
- Modify: `src/lib/format.ts`
- Test: `src/lib/__tests__/format.test.ts`

**Interfaces:**
- Consumes: `getEffectiveServiceCents` from `src/lib/calculator.ts` and `PersonBreakdown.serviceShareCents` (Task 1).
- Produces: no new exports.

- [ ] **Step 1: Write the failing tests for the exports**

`src/lib/__tests__/format.test.ts` currently only covers `timeAgo`. Replace its existing
`import { timeAgo } from "../format";` line with a single merged import — do not add a
second import from the same module — and add the fixtures below it:

```ts
import { timeAgo, generateShareText, generateCsv } from "../format";
import { calculateBreakdowns } from "../calculator";
import { ReceiptItem, Person, TaxTip, initialTaxTip } from "@/types";

function makeItem(id: string, priceCents: number, assignedTo: string[]): ReceiptItem {
  return { id, name: id, quantity: 1, priceCents, assignedTo };
}

function makePerson(id: string): Person {
  return { id, name: id, color: "#000" };
}

const noCharges: TaxTip = {
  ...initialTaxTip,
  taxCents: 0,
  taxIsPercent: false,
  tipCents: 0,
  tipIsPercent: false,
  tipPercent: 0,
};

function fixture(taxTip: TaxTip) {
  const items = [makeItem("a", 6000, ["p1"]), makeItem("b", 4000, ["p2"])];
  const people = [makePerson("p1"), makePerson("p2")];
  const breakdowns = calculateBreakdowns(items, people, taxTip);
  return { items, breakdowns };
}
```

Then append:

```ts
describe("generateShareText service charge", () => {
  it("includes a Service total when there is a service charge", () => {
    const taxTip = { ...noCharges, serviceCents: 1000 };
    const { items, breakdowns } = fixture(taxTip);

    const text = generateShareText(items, taxTip, breakdowns, "USD");

    expect(text).toContain("Service: $10.00");
  });

  it("includes each person's service share", () => {
    const taxTip = { ...noCharges, serviceCents: 1000 };
    const { items, breakdowns } = fixture(taxTip);

    const text = generateShareText(items, taxTip, breakdowns, "USD");

    expect(text).toContain("• Service: $6.00");
    expect(text).toContain("• Service: $4.00");
  });

  it("adds the service charge to the grand total", () => {
    const taxTip = { ...noCharges, serviceCents: 1000 };
    const { items, breakdowns } = fixture(taxTip);

    const text = generateShareText(items, taxTip, breakdowns, "USD");

    expect(text).toContain("Total: $110.00");
  });

  it("omits Service entirely when there is no service charge", () => {
    const { items, breakdowns } = fixture(noCharges);

    const text = generateShareText(items, noCharges, breakdowns, "USD");

    expect(text).not.toContain("Service");
  });
});

describe("generateCsv service charge", () => {
  it("includes a Service row with per-person shares", () => {
    const taxTip = { ...noCharges, serviceCents: 1000 };
    const { items, breakdowns } = fixture(taxTip);

    const csv = generateCsv(items, taxTip, breakdowns, "USD");

    expect(csv).toContain("Service,,,10.00,6.00,4.00");
  });

  it("adds the service charge to the Total row", () => {
    const taxTip = { ...noCharges, serviceCents: 1000 };
    const { items, breakdowns } = fixture(taxTip);

    const csv = generateCsv(items, taxTip, breakdowns, "USD");

    expect(csv).toContain("Total,,,110.00,66.00,44.00");
  });

  it("omits the Service row when there is no service charge", () => {
    const { items, breakdowns } = fixture(noCharges);

    const csv = generateCsv(items, noCharges, breakdowns, "USD");

    expect(csv).not.toContain("Service");
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/__tests__/format.test.ts`

Expected: FAIL — the Service assertions fail because `format.ts` emits no Service line, and the Total assertions fail because the grand total omits the service charge.

- [ ] **Step 3: Add Service to the share text**

In `src/lib/format.ts`, add `getEffectiveServiceCents` to the import from `./calculator`.

In `generateShareText`, after the `tipCents` declaration:

```ts
  const serviceCents = getEffectiveServiceCents(taxTip, subtotal);
```

Change the `grandTotal` line to:

```ts
  const grandTotal = subtotal + taxCents + serviceCents + tipCents;
```

The summary block must omit Service when zero, so build the lines conditionally. Replace the `lines` initializer with:

```ts
  const lines: string[] = [
    "Shplit",
    "─".repeat(30),
    `Subtotal: ${formatMoney(subtotal, currency)}`,
    `Tax: ${formatMoney(taxCents, currency)}`,
  ];
  if (serviceCents > 0) {
    lines.push(`Service: ${formatMoney(serviceCents, currency)}`);
  }
  lines.push(
    `Tip: ${formatMoney(tipCents, currency)}`,
    `Total: ${formatMoney(grandTotal, currency)}`,
    "",
    "Per Person:",
    "─".repeat(30)
  );
```

In the per-person loop, between the Tax and Tip blocks:

```ts
    if (b.serviceShareCents > 0) {
      lines.push(`  • Service: ${formatMoney(b.serviceShareCents, currency)}`);
    }
```

- [ ] **Step 4: Add Service to the CSV**

In `generateCsv`, after the `tipCents` declaration:

```ts
  const serviceCents = getEffectiveServiceCents(taxTip, subtotal);
```

Between the Tax row and the Tip row:

```ts
  // Service row, omitted when there is no service charge
  if (serviceCents > 0) {
    rows.push(["Service", "", "", formatMoneyRaw(serviceCents, currency), ...breakdowns.map((b) => formatMoneyRaw(b.serviceShareCents, currency))]);
  }
```

Change the `grandTotal` line to:

```ts
  const grandTotal = subtotal + taxCents + serviceCents + tipCents;
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/lib/__tests__/format.test.ts`

Expected: PASS, including the five original `timeAgo` tests.

- [ ] **Step 6: Add the SERVICE row to `TotalsSection`**

In `src/components/receipt/TotalsSection.tsx`, add `getEffectiveServiceCents` to the import from `@/lib/calculator`.

Add the preset constant next to the existing two:

```ts
// Common venue service charges. Distinct from TIP_PRESETS, which start higher
// because a discretionary tip is typically larger than an added service fee.
const SERVICE_PRESETS = [10, 12.5, 15, 18];
```

In the `TotalsSection` function body, after `const tip = ...`:

```ts
  const service = getEffectiveServiceCents(taxTip, subtotal);
```

Change the total:

```ts
  const total = subtotal + tax + service + tip;
```

In the editable branch, between the TAX and TIP `EditableTaxTipRow` elements. The wrapper carries `no-print` when the amount is zero, so a printout never shows `SERVICE $0.00`, while the row stays on screen so a charge can be added by hand:

```tsx
            <div className={service === 0 ? "no-print" : undefined}>
              <EditableTaxTipRow
                label="SERVICE"
                isPercent={taxTip.serviceIsPercent}
                percent={taxTip.servicePercent}
                cents={service}
                presets={SERVICE_PRESETS}
                currency={currency}
                onToggleMode={(isPercent) => onChange({ serviceIsPercent: isPercent })}
                onChangePercent={(pct) => onChange({ servicePercent: pct })}
                onChangeCents={(cents) => onChange({ serviceCents: cents })}
                collapseKey={collapseKey}
                onExpand={onRowExpand}
              />
            </div>
```

In the read-only branch, between the TAX and TIP rows, rendered only when non-zero:

```tsx
            {service > 0 && (
              <div className="print-muted flex items-baseline text-ink-muted">
                <span className="shrink-0 uppercase">
                  SERVICE{taxTip.serviceIsPercent ? ` (${taxTip.servicePercent}%)` : ""}
                </span>
                <span className="mx-1 flex-1 overflow-hidden whitespace-nowrap text-ink-faded" aria-hidden="true">{"·".repeat(50)}</span>
                <span className="shrink-0">{formatMoney(service, currency)}</span>
              </div>
            )}
```

- [ ] **Step 7: Add the service line to `SplitSection`**

In `src/components/receipt/SplitSection.tsx`, add `serviceShareCents` to the destructuring on line 45:

```ts
  const { person, items, subtotalCents, taxShareCents, serviceShareCents, tipShareCents, totalCents } = breakdown;
```

Between the `taxShareCents > 0 &&` and `tipShareCents > 0 &&` blocks:

```tsx
        {serviceShareCents > 0 && (
          <div className="print-muted flex items-baseline font-receipt text-base text-ink-muted">
            <span className="shrink-0">service</span>
            <span className="mx-1 flex-1 overflow-hidden whitespace-nowrap text-ink-faded" aria-hidden="true">{"·".repeat(50)}</span>
            <span className="shrink-0">{formatMoney(serviceShareCents, currency)}</span>
          </div>
        )}
```

- [ ] **Step 8: Run the full suite, typecheck, lint, and build**

Run: `npm test && npx tsc --noEmit && npx eslint src/lib/format.ts src/components/receipt/TotalsSection.tsx src/components/receipt/SplitSection.tsx && npm run build`

Expected: all tests PASS, tsc clean, no lint output for those files, build compiles.

- [ ] **Step 9: Commit**

```bash
git add src/lib/format.ts src/lib/__tests__/format.test.ts src/components/receipt/TotalsSection.tsx src/components/receipt/SplitSection.tsx
git commit -m "feat: show service charge in totals, split, and exports"
```

---

### Task 5: End-to-end verification

**Files:**
- Create: scratch scripts and images outside the repo (do not commit)

**Interfaces:**
- Consumes: the whole feature.
- Produces: nothing.

- [ ] **Step 1: Build and start the production server**

```bash
npm run build && (npm run start -- -p 3111 &) && sleep 5 && curl -sf -o /dev/null http://localhost:3111 && echo up
```

Expected: `up`.

- [ ] **Step 2: Generate two receipt images**

Write this to a scratch directory (not the repo) as `gen.py` and run it with `python3 gen.py`. PIL is already installed.

```python
from PIL import Image, ImageDraw, ImageFont
import base64, io, json

def build(path, with_service):
    f = ImageFont.truetype('/System/Library/Fonts/Supplemental/Courier New.ttf', 22)
    fb = ImageFont.truetype('/System/Library/Fonts/Supplemental/Courier New Bold.ttf', 28)
    im = Image.new('RGB', (620, 620), 'white')
    d = ImageDraw.Draw(im)
    d.text((150, 25), 'THE GARDEN BISTRO', font=fb, fill='black')
    y = 100
    items = [('Grilled Chicken', 2884), ('Caesar Salad', 1425), ('Margherita Pizza', 1830)]
    sub = 0
    for name, p in items:
        sub += p
        d.text((40, y), f'1 x {name}', font=f, fill='black')
        d.text((470, y), f'${p/100:>8.2f}', font=f, fill='black')
        y += 34
    y += 20
    rows = [('SUBTOTAL', sub), ('TAX', round(sub * 0.0875))]
    if with_service:
        rows.append(('SERVICE CHARGE 18%', round(sub * 0.18)))
    total = sum(v for _, v in rows[1:]) + sub
    rows.append(('TOTAL', total))
    for lbl, v in rows:
        d.text((40, y), lbl, font=f, fill='black')
        d.text((470, y), f'${v/100:>8.2f}', font=f, fill='black')
        y += 34
    b = io.BytesIO()
    im.save(b, 'JPEG', quality=85)
    open(path, 'w').write(json.dumps({'image': 'data:image/jpeg;base64,' + base64.b64encode(b.getvalue()).decode()}))
    print('wrote', path)

build('with_service.json', True)
build('no_service.json', False)
```

- [ ] **Step 3: Verify the service charge is captured**

```bash
curl -sS --max-time 90 -X POST http://localhost:3111/api/ocr \
  -H 'Content-Type: application/json' --data @with_service.json
```

Expected: HTTP 200, `serviceChargeCents` roughly `1105` (18% of the $61.39 subtotal), and `tipCents` null.

- [ ] **Step 4: Verify the no-service receipt is unchanged**

```bash
curl -sS --max-time 90 -X POST http://localhost:3111/api/ocr \
  -H 'Content-Type: application/json' --data @no_service.json
```

Expected: HTTP 200, `serviceChargeCents` is `null`, items and `taxCents` populated as before. This is the non-regression invariant.

- [ ] **Step 5: Verify the tip-zeroing decision in code**

Run: `npx vitest run src/lib/__tests__/taxTip.test.ts -t "zeroes the tip"`

Expected: PASS. This is the unit-level proof that a detected service charge sets `tipPercent: 0`; the route itself does not apply `TaxTip` defaults, `ScanSection` does.

- [ ] **Step 6: Stop the server**

```bash
pkill -f "next start"
```

- [ ] **Step 7: Final full verification**

Run: `npm test && npx tsc --noEmit && npm run build`

Expected: all tests PASS, tsc clean, build compiles.

Note: `npx eslint src` reports 8 pre-existing errors on `main` in components and hooks unrelated to this work. Confirm your count matches 8 and that none are in files this plan touched.

- [ ] **Step 8: Open the pull request**

```bash
git push -u origin feat/service-charge
gh pr create --base main --title "feat: account for service charges automatically" --body "See docs/superpowers/specs/2026-08-09-service-charge-design.md"
```

---

## Verification Checklist

- [ ] `TaxTip` carries `serviceCents`, `serviceIsPercent`, `servicePercent`; `initialTaxTip` defaults them to `0 / false / 18`
- [ ] `PersonBreakdown.serviceShareCents` is populated and included in `totalCents`
- [ ] Service shares sum exactly to the effective charge (last-person-remainder)
- [ ] Tax is still a percentage of the subtotal only, never compounded on the service charge
- [ ] The prompt captures `serviceChargeCents` and still excludes fees from `items`
- [ ] Several fees on one receipt are summed into one figure
- [ ] A detected service charge zeroes the tip, unless the receipt also reported a tip
- [ ] A legacy `taxTip` without service keys yields `0`, never `NaN`
- [ ] With no service charge, totals, share text, and CSV are unchanged from `main`
- [ ] SERVICE row appears between TAX and TIP in totals, split, share text, and CSV
- [ ] Full suite passes, `tsc --noEmit` clean, `npm run build` clean
