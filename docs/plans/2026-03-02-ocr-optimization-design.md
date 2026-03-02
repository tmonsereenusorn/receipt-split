# OCR Parser Optimization Design

**Goal:** Improve receipt item extraction by expanding regex pattern coverage and refining skip/price logic, without adding LLM dependency.

**Problem:** The current parser (4 patterns, 25 skip patterns) misses items on many receipt formats — non-ASCII names, `@` qty separators, dot-leader lines, `#`/digit-prefixed items, and prices without exactly 2 decimal places.

**Approach:** Expanded pattern matching (regex only). Add 3 new patterns, fix 3 existing behaviors, refine 6 skip patterns, and improve price parsing.

## Section 1: New Patterns & Pattern Fixes

### New patterns

- **P5: `@` qty separator** — `Coffee 2 @ $4.50 $9.00` → qty 2, unit price 450. Captures `name qty @ unit_price [total_price]`.
- **P6: Dot/dash leader** — `Burger........12.99` or `Fries --- 4.50`. Strips `.` and `-` leaders between name and price.
- **P7: `#`/digit-start items** — `#1 Combo Meal 12.99` or `2. Pad Thai 14.50`. Strips leading `#N` or `N.` prefix, parses remainder as name + price.

### Fixes to existing patterns

- **Relax 2-decimal requirement:** `\.\d{2}` → `\.?\d{0,2}` across P1-P3 and `isPriceLine()`. Allows `12`, `12.5`, `12.99`.
- **Allow non-ASCII first characters:** `^[A-Za-z]` → `^[^\d$]` in P2, P3, `isNameLine()`. Handles `Crème Brûlée`, `Ñoquis`.
- **Multi-line price-then-name:** Pattern 4 currently only handles name→price. Add reverse: price line followed by name line.

## Section 2: Skip Pattern & Price Parsing Refinements

### Skip pattern changes

1. `/\bcard\b/i` → remove. Replace with combined `/\b(credit|debit)\s*card\b/i`.
2. `/\bchange\b/i` → `/\bchange\s*due\b/i` (avoids false positive on item names).
3. `/\bbalance\b/i` → `/\bbalance\s*(due|owing|forward)\b/i` (avoids "Balance Bowl").
4. Remove standalone `/\bcredit\b/i` and `/\bdebit\b/i` — covered by combined card pattern.
5. Add `/\bservice\s*charge\b/i`.
6. Add `/\bdiscount\b/i`.
7. Add `/\bsales\s*total\b/i`.

### `parseCents()` changes

- Allow 0-2 decimal places: `12` → 1200, `12.9` → 1290, `12.99` → 1299.
- Allow `$0.00` (comped items): change `num <= 0` to `num < 0`.

### Multi-line improvements

- `isNameLine()`: allow non-ASCII first characters (`^[^\d$]` instead of `^[A-Za-z]`).
- Handle price-then-name order in Pattern 4.

## Section 3: Testing Strategy

### New test cases (~15 tests)

**New patterns:**
- P5: `Coffee 2 @ $4.50 $9.00` → qty 2, price 450
- P6: `Burger........12.99` → qty 1, price 1299
- P6: `Fries --- 4.50` → qty 1, price 450
- P7: `#1 Combo Meal 12.99` → qty 1, price 1299
- P7: `2. Pad Thai 14.50` → qty 1, price 1450

**Pattern fixes:**
- Non-ASCII: `Crème Brûlée 9.50` → qty 1, price 950
- Flexible decimals: `Beer 8` → qty 1, price 800
- Flexible decimals: `Wine 12.5` → qty 1, price 1250
- Price-then-name multi-line: `9.50\nCHICKEN KARAAGE` → qty 1, price 950

**Skip pattern refinements:**
- `Gift Card 25.00` parses as item (not skipped)
- `Balance Bowl 14.00` parses as item (not skipped)
- `20% SERVICE CHARGE: 64.41` skipped
- `Cash Discount: -12.50` skipped
- `SALES TOTAL: 355.38` skipped

**Regression:** All 14 existing parser tests remain unchanged and passing.

## Files Changed

- Modify: `src/lib/parser.ts`
- Modify: `src/lib/__tests__/parser.test.ts`
- No UI, API, or component changes.
