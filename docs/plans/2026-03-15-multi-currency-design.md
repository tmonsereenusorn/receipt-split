# Multi-Currency Support Design

## Problem

The app assumes USD everywhere — hardcoded `$` in display, OCR prompt returns dollar cents, no currency field in the data model.

## Solution: Per-Receipt Currency with Smallest-Subunit Storage

### Data Model

Add `currency: string` (ISO 4217, e.g. `"USD"`, `"JPY"`, `"EUR"`) to `ReceiptDoc`. Default `"USD"` for backward compatibility. All `priceCents`/`taxCents`/`tipCents` fields stay as integers in smallest subunit. No field renames.

### Display Layer

Replace `formatCents()` with currency-aware `formatMoney(subunits, currency)`:
- Use `Intl.NumberFormat` to determine decimal places per currency (no manual mapping)
- Convert subunits to major unit: `subunits / 10^decimals`
- Format via `new Intl.NumberFormat('en', { style: 'currency', currency })`

All components switch from `formatCents` to `formatMoney` with the receipt's currency.

### OCR Pipeline

Prompt asks Claude to detect currency and return ISO code. Values returned in smallest subunit for that currency. Defaults to `"USD"` if undetectable.

### Currency Selector

Dropdown on the receipt page (header area) showing currency code. Changing it calls `fsSetCurrency` (simple `updateDoc`). No value conversion — just re-labels display.

### Default for Manual Entry

Use `navigator.language` → `Intl.NumberFormat` to infer default currency. E.g., `en-US` → `USD`, `ja-JP` → `JPY`.

### Backward Compatibility

Existing receipts without `currency` field default to `"USD"` via `?? "USD"` in the hook.

### Testing

Unit tests for:
- `formatMoney` — correct formatting for USD (2 decimals), JPY (0 decimals), BHD (3 decimals)
- `subunitDecimals` — correct decimal counts for various currencies
- `defaultCurrencyFromLocale` — locale string to ISO currency mapping
