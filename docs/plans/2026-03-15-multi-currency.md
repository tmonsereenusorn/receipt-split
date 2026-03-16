# Multi-Currency Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Support per-receipt currency so the app works with any world currency, not just USD.

**Architecture:** Add `currency` field (ISO 4217) to `ReceiptDoc`. Create currency utility functions (`formatMoney`, `subunitDecimals`, `currencySymbol`, `defaultCurrencyFromLocale`) in a new `src/lib/currency.ts`. Replace all `formatCents` usage with `formatMoney`. Update OCR to detect currency. Add currency selector to receipt header.

**Tech Stack:** TypeScript, `Intl.NumberFormat` (built-in), Vitest for tests

---

### Task 1: Create currency utilities with tests

**Files:**
- Create: `src/lib/currency.ts`
- Create: `src/lib/__tests__/currency.test.ts`

**Step 1: Write the tests**

Create `src/lib/__tests__/currency.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { subunitDecimals, formatMoney, formatMoneyRaw, currencySymbol, defaultCurrencyFromLocale } from "../currency";

describe("subunitDecimals", () => {
  it("returns 2 for USD", () => {
    expect(subunitDecimals("USD")).toBe(2);
  });

  it("returns 0 for JPY", () => {
    expect(subunitDecimals("JPY")).toBe(0);
  });

  it("returns 3 for BHD", () => {
    expect(subunitDecimals("BHD")).toBe(3);
  });

  it("returns 2 for EUR", () => {
    expect(subunitDecimals("EUR")).toBe(2);
  });
});

describe("formatMoney", () => {
  it("formats USD cents correctly", () => {
    expect(formatMoney(1299, "USD")).toBe("$12.99");
  });

  it("formats JPY with no decimals", () => {
    expect(formatMoney(1500, "JPY")).toBe("¥1,500");
  });

  it("formats EUR correctly", () => {
    expect(formatMoney(999, "EUR")).toBe("€9.99");
  });

  it("formats BHD with 3 decimals", () => {
    expect(formatMoney(1500, "BHD")).toBe("BHD\u00a01.500");
  });

  it("formats zero", () => {
    expect(formatMoney(0, "USD")).toBe("$0.00");
  });
});

describe("formatMoneyRaw", () => {
  it("formats USD without symbol", () => {
    expect(formatMoneyRaw(1299, "USD")).toBe("12.99");
  });

  it("formats JPY without symbol", () => {
    expect(formatMoneyRaw(1500, "JPY")).toBe("1500");
  });
});

describe("currencySymbol", () => {
  it("returns $ for USD", () => {
    expect(currencySymbol("USD")).toBe("$");
  });

  it("returns ¥ for JPY", () => {
    expect(currencySymbol("JPY")).toBe("¥");
  });

  it("returns € for EUR", () => {
    expect(currencySymbol("EUR")).toBe("€");
  });
});

describe("defaultCurrencyFromLocale", () => {
  it("returns USD for en-US", () => {
    expect(defaultCurrencyFromLocale("en-US")).toBe("USD");
  });

  it("returns JPY for ja-JP", () => {
    expect(defaultCurrencyFromLocale("ja-JP")).toBe("JPY");
  });

  it("returns GBP for en-GB", () => {
    expect(defaultCurrencyFromLocale("en-GB")).toBe("GBP");
  });

  it("returns USD for unknown locale", () => {
    expect(defaultCurrencyFromLocale("xx")).toBe("USD");
  });

  it("returns EUR for de-DE", () => {
    expect(defaultCurrencyFromLocale("de-DE")).toBe("EUR");
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — module `../currency` not found

**Step 3: Implement currency utilities**

Create `src/lib/currency.ts`:

```ts
/**
 * Get the number of decimal places for a currency's subunit.
 * Uses Intl.NumberFormat to avoid maintaining a manual mapping.
 */
export function subunitDecimals(currency: string): number {
  const fmt = new Intl.NumberFormat("en", {
    style: "currency",
    currency,
  });
  return fmt.resolvedOptions().maximumFractionDigits ?? 2;
}

/**
 * Format a subunit amount as a localized currency string.
 * e.g. formatMoney(1299, "USD") → "$12.99"
 *      formatMoney(1500, "JPY") → "¥1,500"
 */
export function formatMoney(subunits: number, currency: string): string {
  const decimals = subunitDecimals(currency);
  const value = subunits / Math.pow(10, decimals);
  return new Intl.NumberFormat("en", {
    style: "currency",
    currency,
  }).format(value);
}

/**
 * Format a subunit amount as a plain number string (no currency symbol).
 * e.g. formatMoneyRaw(1299, "USD") → "12.99"
 *      formatMoneyRaw(1500, "JPY") → "1500"
 */
export function formatMoneyRaw(subunits: number, currency: string): string {
  const decimals = subunitDecimals(currency);
  const value = subunits / Math.pow(10, decimals);
  return decimals === 0 ? String(value) : value.toFixed(decimals);
}

/**
 * Get the symbol for a currency code.
 * e.g. "USD" → "$", "EUR" → "€"
 */
export function currencySymbol(currency: string): string {
  return new Intl.NumberFormat("en", {
    style: "currency",
    currency,
    currencyDisplay: "narrowSymbol",
  })
    .formatToParts(0)
    .find((p) => p.type === "currency")?.value ?? currency;
}

/**
 * Infer a default currency from a locale string (e.g. "en-US" → "USD").
 * Falls back to "USD" if the locale can't be resolved.
 */
export function defaultCurrencyFromLocale(locale: string): string {
  try {
    const fmt = new Intl.NumberFormat(locale, { style: "currency", currency: "USD" });
    // Intl doesn't directly give us locale→currency, so we use a region-based lookup
    const region = locale.split("-")[1]?.toUpperCase();
    if (!region) return "USD";

    // Use Intl.DisplayNames to verify the region exists, then map via a known formatter
    const testFmt = new Intl.NumberFormat(`en-${region}`, {
      style: "currency",
      currency: "USD",
      currencyDisplay: "code",
    });
    // Try to resolve the currency from the region
    const regionCurrencyMap: Record<string, string> = {
      US: "USD", GB: "GBP", JP: "JPY", EU: "EUR", CA: "CAD", AU: "AUD",
      CN: "CNY", KR: "KRW", IN: "INR", MX: "MXN", BR: "BRL", CH: "CHF",
      SE: "SEK", NO: "NOK", DK: "DKK", NZ: "NZD", SG: "SGD", HK: "HKD",
      TW: "TWD", TH: "THB", PH: "PHP", MY: "MYR", ID: "IDR", VN: "VND",
      AE: "AED", SA: "SAR", IL: "ILS", TR: "TRY", ZA: "ZAR", EG: "EGP",
      NG: "NGN", KE: "KES", PL: "PLN", CZ: "CZK", HU: "HUF", RO: "RON",
      BG: "BGN", HR: "EUR", RU: "RUB", UA: "UAH", CL: "CLP", CO: "COP",
      AR: "ARS", PE: "PEN", BH: "BHD", KW: "KWD", QA: "QAR",
      DE: "EUR", FR: "EUR", IT: "EUR", ES: "EUR", NL: "EUR", BE: "EUR",
      AT: "EUR", PT: "EUR", FI: "EUR", IE: "EUR", GR: "EUR", SK: "EUR",
      SI: "EUR", LT: "EUR", LV: "EUR", EE: "EUR", LU: "EUR", MT: "EUR",
      CY: "EUR",
    };
    return regionCurrencyMap[region] ?? "USD";
  } catch {
    return "USD";
  }
}
```

**Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: All tests pass

**Step 5: Commit**

```bash
git add src/lib/currency.ts src/lib/__tests__/currency.test.ts
git commit -m "feat: add currency utility functions with tests"
```

---

### Task 2: Add currency to data model and Firestore

**Files:**
- Modify: `src/types/index.ts:40-48`
- Modify: `src/lib/firestore.ts`
- Modify: `src/hooks/useFirestoreReceipt.ts`

**Step 1: Add `currency` to `ReceiptDoc`**

In `src/types/index.ts`, add `currency` field to the `ReceiptDoc` interface:

```ts
export interface ReceiptDoc {
  restaurantName: string | null;
  currency: string;
  items: ReceiptItem[];
  people: Person[];
  taxTip: TaxTip;
  imageDataUrl: string | null;
  ocrText: string | null;
  createdAt: number;
}
```

**Step 2: Update `createReceipt` in `src/lib/firestore.ts`**

Add `currency` to the default data in `createReceipt`:

```ts
const data: ReceiptDoc = {
  restaurantName: partial.restaurantName ?? null,
  currency: partial.currency ?? "USD",
  items: partial.items ?? [],
  // ... rest stays the same
};
```

**Step 3: Add `fsSetCurrency` to `src/lib/firestore.ts`**

Add after `fsSetRestaurantName`:

```ts
/** Set currency */
export async function fsSetCurrency(id: string, currency: string) {
  await updateDoc(receiptRef(id), { currency });
}
```

**Step 4: Update `useFirestoreReceipt` hook**

In `src/hooks/useFirestoreReceipt.ts`:

1. Import `fsSetCurrency`
2. Add `currency` to the derived values: `const currency = data?.currency ?? "USD";`
3. Add a `setCurrency` callback with optimistic update:

```ts
const setCurrency = useCallback(
  (currency: string) => {
    setData(prev => prev ? { ...prev, currency } : prev);
    fsSetCurrency(receiptId, currency);
  },
  [receiptId]
);
```

4. Return `currency` and `setCurrency` from the hook.

**Step 5: Build and verify**

Run: `npm run build`
Expected: Compiles successfully (some TS warnings about unused `currency` are OK for now)

**Step 6: Commit**

```bash
git add src/types/index.ts src/lib/firestore.ts src/hooks/useFirestoreReceipt.ts
git commit -m "feat: add currency field to ReceiptDoc and Firestore"
```

---

### Task 3: Replace formatCents with formatMoney across components

**Files:**
- Modify: `src/lib/format.ts`
- Modify: `src/components/receipt/ScanSection.tsx`
- Modify: `src/components/receipt/ItemRow.tsx`
- Modify: `src/components/receipt/TotalsSection.tsx`
- Modify: `src/components/receipt/SplitSection.tsx`
- Modify: `src/components/receipt/PrintItemsList.tsx`
- Modify: `src/components/receipt/ItemsSection.tsx`
- Modify: `src/app/receipt/[id]/ReceiptPageClient.tsx`

**Step 1: Update `format.ts`**

Replace `formatCents` and `formatCentsRaw` with wrappers that delegate to currency utils. Keep the old function names as deprecated aliases to avoid a massive diff:

Actually — replace all usages directly. Remove `formatCents` and `formatCentsRaw` from `format.ts`. Update `generateShareText` and `generateCsv` to accept a `currency` parameter and use `formatMoney`/`formatMoneyRaw` from `currency.ts`.

In `src/lib/format.ts`:
- Remove `formatCents` and `formatCentsRaw`
- Import `formatMoney` and `formatMoneyRaw` from `./currency`
- Add `currency: string` parameter to `generateShareText` and `generateCsv`
- Replace all `formatCents(x)` calls with `formatMoney(x, currency)`
- Replace all `formatCentsRaw(x)` calls with `formatMoneyRaw(x, currency)`

**Step 2: Update components to accept and pass `currency` prop**

Thread `currency` from `ReceiptPageClient` → child components:

- `ReceiptPageClient`: pass `currency={receipt.currency}` to all components that format money
- `ItemsSection`: add `currency` prop, pass to `ItemRow`
- `ItemRow`: add `currency` prop, use `formatMoney(total, currency)` and `currencySymbol(currency)` for the `$` label
- `TotalsSection`: add `currency` prop, use `formatMoney` and `currencySymbol` for the `$` label
- `SplitSection`: add `currency` prop, use `formatMoney`
- `ScanSection`: use `formatMoney` with `"USD"` default (OCR result preview before receipt creation)
- `PrintItemsList`: add `currency` prop, use `formatMoney`
- `generateShareText` / `generateCsv`: called in `ReceiptPageClient`, pass `receipt.currency`

**Step 3: Replace hardcoded `$` labels**

In `TotalsSection.tsx` line 140 and `ItemRow.tsx` line 325, replace:
```tsx
<span className="font-receipt text-sm text-ink-faded">$</span>
```
with:
```tsx
<span className="font-receipt text-sm text-ink-faded">{currencySymbol(currency)}</span>
```

**Step 4: Update existing format tests**

In `src/lib/__tests__/format.test.ts`, the existing tests don't test `formatCents` (only `timeAgo`), so no changes needed.

**Step 5: Build and run tests**

Run: `npm run build && npm test`
Expected: Build passes, all tests pass

**Step 6: Commit**

```bash
git add src/lib/format.ts src/components/ src/app/receipt/
git commit -m "feat: replace formatCents with currency-aware formatMoney"
```

---

### Task 4: Update OCR to detect and return currency

**Files:**
- Modify: `src/app/api/ocr/route.ts`
- Modify: `src/lib/ocr.ts`
- Modify: `src/components/receipt/ScanSection.tsx`
- Modify: `src/app/page.tsx`

**Step 1: Update the OCR prompt**

In `src/app/api/ocr/route.ts`, update `EXTRACTION_PROMPT` to include currency detection:

Add to the JSON schema: `"currency": "ISO 4217 code, e.g. USD, EUR, JPY"`

Add to the rules: `- currency: the ISO 4217 currency code detected from the receipt (look for currency symbols like $, €, ¥, £, or text). Default to "USD" if unclear.`

**Step 2: Update `ClaudeResponse` and `parseAndValidate`**

Add `currency: string` to `ClaudeResponse`. In `parseAndValidate`, extract and validate:

```ts
const currency =
  typeof parsed.currency === "string" && parsed.currency.length === 3
    ? parsed.currency.toUpperCase()
    : "USD";
```

Return `currency` in the result. Include in the JSON response.

**Step 3: Update `OcrResult` in `src/lib/ocr.ts`**

Add `currency: string` to `OcrResult`. Extract from API response: `currency: typeof data.currency === "string" ? data.currency : "USD"`.

**Step 4: Update `ScanResult` in `ScanSection.tsx`**

Add `currency: string` to `ScanResult`. Pass `result.currency` through in `handleCapture`.

**Step 5: Update landing page**

In `src/app/page.tsx`:
- `handleScanResult`: pass `currency: result.currency` to `createReceipt`
- `handleSkip`: use `defaultCurrencyFromLocale(navigator.language)` for the currency

**Step 6: Build and run tests**

Run: `npm run build && npm test`
Expected: All pass

**Step 7: Commit**

```bash
git add src/app/api/ocr/route.ts src/lib/ocr.ts src/components/receipt/ScanSection.tsx src/app/page.tsx
git commit -m "feat: OCR detects currency, manual entry uses browser locale"
```

---

### Task 5: Add currency selector to receipt header

**Files:**
- Modify: `src/components/receipt/ReceiptHeader.tsx`
- Modify: `src/app/receipt/[id]/ReceiptPageClient.tsx`

**Step 1: Check current ReceiptHeader**

Read `src/components/receipt/ReceiptHeader.tsx` to understand its current props and layout.

**Step 2: Add currency selector**

Add `currency` and `onChangeCurrency` props to `ReceiptHeader`. Render a small `<select>` dropdown next to the restaurant name showing common currencies. Use a curated list of ~15 most common currencies (USD, EUR, GBP, JPY, CAD, AUD, CHF, CNY, KRW, INR, MXN, BRL, SGD, HKD, TWD).

Style it to match the receipt aesthetic (font-receipt, minimal border).

**Step 3: Wire up in ReceiptPageClient**

Pass `currency={receipt.currency}` and `onChangeCurrency={receipt.setCurrency}` to `ReceiptHeader`.

**Step 4: Build and verify**

Run: `npm run build`
Expected: Compiles successfully

**Step 5: Commit**

```bash
git add src/components/receipt/ReceiptHeader.tsx src/app/receipt/[id]/ReceiptPageClient.tsx
git commit -m "feat: add currency selector to receipt header"
```
