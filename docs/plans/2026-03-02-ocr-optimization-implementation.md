# OCR Parser Optimization Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Expand the receipt parser from 4 to 7 regex patterns, refine skip patterns and price parsing, so fewer items are missed across diverse receipt formats.

**Architecture:** All changes are in `src/lib/parser.ts` (implementation) and `src/lib/__tests__/parser.test.ts` (tests). No UI, API, or component changes. TDD: write failing tests first, then implement. Three logical chunks: (1) price parsing + skip patterns, (2) fixes to existing patterns, (3) three new patterns.

**Tech Stack:** TypeScript, Vitest 4, regex

---

### Task 1: Improve `parseCents()` and skip patterns

**Files:**
- Modify: `src/lib/__tests__/parser.test.ts`
- Modify: `src/lib/parser.ts`

**Step 1: Write the failing tests**

Add these test cases inside the existing `describe("parseReceiptText", ...)` block, after the last `it(...)` at line 181 in `src/lib/__tests__/parser.test.ts`:

```typescript
  it("parses prices with 0-1 decimal places", () => {
    const items = parseReceiptText("Beer 8\nWine 12.5");
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({ name: "Beer", priceCents: 800 });
    expect(items[1]).toMatchObject({ name: "Wine", priceCents: 1250 });
  });

  it("does not skip 'Gift Card' as an item", () => {
    const items = parseReceiptText("Gift Card 25.00");
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ name: "Gift Card", priceCents: 2500 });
  });

  it("does not skip 'Balance Bowl' as an item", () => {
    const items = parseReceiptText("Balance Bowl 14.00");
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ name: "Balance Bowl", priceCents: 1400 });
  });

  it("skips service charge, discount, and sales total lines", () => {
    const text = `Burger 12.99
20% SERVICE CHARGE: 64.41
Cash Discount: -12.50
SALES TOTAL: 355.38`;
    const items = parseReceiptText(text);
    expect(items).toHaveLength(1);
    expect(items[0].name).toBe("Burger");
  });
```

**Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: 4 new tests FAIL — "Beer" not parsed (strict 2-decimal), "Gift Card" skipped by `/\bcard\b/i`, "Balance Bowl" skipped by `/\bbalance\b/i`, service charge/discount lines parsed as items.

**Step 3: Implement the changes in `src/lib/parser.ts`**

**3a. Update `parseCents()`** (lines 16-30):

Replace the entire `parseCents` function with:

```typescript
function parseCents(priceStr: string): number | null {
  // Remove dollar signs, spaces
  let cleaned = priceStr.replace(/[$\s]/g, "");
  // Handle comma as thousands separator (1,299 -> 1299) or decimal (1,99 -> 1.99)
  if (/^\d{1,3},\d{3}/.test(cleaned)) {
    cleaned = cleaned.replace(/,/g, "");
  } else if (/,\d{2}$/.test(cleaned)) {
    cleaned = cleaned.replace(",", ".");
  }
  const num = parseFloat(cleaned);
  if (isNaN(num) || num < 0) return null;
  return Math.round(num * 100);
}
```

Changes: `num <= 0` → `num < 0` (allow $0.00 comped items).

**3b. Update `SKIP_PATTERNS`** (lines 61-96):

Replace the entire `SKIP_PATTERNS` array with:

```typescript
const SKIP_PATTERNS = [
  /^\s*$/,
  /subtotal/i,
  /sub\s*total/i,
  /^total/i,
  /\btax\b/i,
  /\btip\b/i,
  /\bgratuity\b/i,
  /\bchange\s*due\b/i,
  /\bbalance\s*(due|owing|forward)\b/i,
  /\bamount\s*due\b/i,
  /\bvisa\b/i,
  /\bmastercard\b/i,
  /\bcash\b/i,
  /\b(credit|debit)\s*card\b/i,
  /\bpayment\b/i,
  /thank\s*you/i,
  /\bguest\b/i,
  /\bserver\b/i,
  /\bcheck\s*#/i,
  /\btable\b/i,
  /\bdate\b/i,
  /\btime\b/i,
  /\border\s*#/i,
  /\bphone\b/i,
  /\baddress\b/i,
  /www\./i,
  /\.com/i,
  /^\d{1,2}[/:]\d{2}/,
  /^\d{1,2}-\d{1,2}-\d{2,4}/,
  /^\*+$/,
  /^-+$/,
  /^=+$/,
  /\bservice\s*charge\b/i,
  /\bdiscount\b/i,
  /\bsales\s*total\b/i,
];
```

Changes from original:
- Removed: `/\bchange\b/i` → replaced with `/\bchange\s*due\b/i`
- Removed: `/\bbalance\b/i` → replaced with `/\bbalance\s*(due|owing|forward)\b/i`
- Removed: `/\bcredit\b/i`, `/\bdebit\b/i`, `/\bcard\b/i` → replaced with `/\b(credit|debit)\s*card\b/i`
- Added: `/\bservice\s*charge\b/i`, `/\bdiscount\b/i`, `/\bsales\s*total\b/i`

**3c. Update price regex in patterns** to allow 0-2 decimal places:

In Pattern 1 (line 134), replace:
```typescript
/^(\d+)\s*[xX×]\s+(.+?)\s+\$?([\d,]+\.\d{2})\s*$/
```
with:
```typescript
/^(\d+)\s*[xX×]\s+(.+?)\s+\$?([\d,]+(?:\.\d{1,2})?)\s*$/
```

In Pattern 2 (line 153), replace:
```typescript
/^(\d+)\s+([A-Za-z].+?)\s+\$?([\d,]+\.\d{2})\s*$/
```
with:
```typescript
/^(\d+)\s+([A-Za-z].+?)\s+\$?([\d,]+(?:\.\d{1,2})?)\s*$/
```

In Pattern 3 (line 174), replace:
```typescript
/^([A-Za-z].+?)\s+\$?([\d,]+\.\d{2})\s*$/
```
with:
```typescript
/^([A-Za-z].+?)\s+\$?([\d,]+(?:\.\d{1,2})?)\s*$/
```

In `isPriceLine()` (line 106), replace:
```typescript
return /^\$?[\d,]+\.\d{2}\s*$/.test(line.trim());
```
with:
```typescript
return /^\$?[\d,]+(?:\.\d{1,2})?\s*$/.test(line.trim());
```

**Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: All tests pass (14 existing + 4 new = 18)

**Step 5: Commit**

```bash
git add src/lib/parser.ts src/lib/__tests__/parser.test.ts
git commit -m "feat: improve parseCents, skip patterns, and price flexibility"
```

---

### Task 2: Fix existing patterns for non-ASCII and multi-line

**Files:**
- Modify: `src/lib/__tests__/parser.test.ts`
- Modify: `src/lib/parser.ts`

**Step 1: Write the failing tests**

Add these test cases inside `describe("parseReceiptText", ...)`, after the tests added in Task 1:

```typescript
  it("parses non-ASCII item names", () => {
    const items = parseReceiptText("Crème Brûlée 9.50");
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ name: "Crème Brûlée", priceCents: 950 });
  });

  it("parses multi-line price-then-name order", () => {
    const items = parseReceiptText("9.50\nCHICKEN KARAAGE");
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      name: "CHICKEN KARAAGE",
      priceCents: 950,
    });
  });
```

**Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: 2 new tests FAIL — "Crème Brûlée" doesn't match `^[A-Za-z]`, price-then-name not handled.

**Step 3: Implement the changes**

**3a. Allow non-ASCII names in Pattern 2** (line ~153 after Task 1 edits):

Replace the Pattern 2 regex:
```typescript
/^(\d+)\s+([A-Za-z].+?)\s+\$?([\d,]+(?:\.\d{1,2})?)\s*$/
```
with:
```typescript
/^(\d+)\s+([^\d$].+?)\s+\$?([\d,]+(?:\.\d{1,2})?)\s*$/
```

**3b. Allow non-ASCII names in Pattern 3**:

Replace the Pattern 3 regex:
```typescript
/^([A-Za-z].+?)\s+\$?([\d,]+(?:\.\d{1,2})?)\s*$/
```
with:
```typescript
/^([^\d$].+?)\s+\$?([\d,]+(?:\.\d{1,2})?)\s*$/
```

**3c. Allow non-ASCII in `isNameLine()`** (line ~113):

Replace:
```typescript
function isNameLine(line: string): boolean {
  return /^[A-Za-z]/.test(line.trim()) && !isPriceLine(line);
}
```
with:
```typescript
function isNameLine(line: string): boolean {
  return /^[^\d$]/.test(line.trim()) && !isPriceLine(line);
}
```

**3d. Add price-then-name multi-line pattern.**

After the existing Pattern 4 block (the `if (isNameLine(line) && i + 1 < lines.length)` block), add:

```typescript
    // Pattern 4b: Multi-line — price on this line, name on next line
    if (isPriceLine(line) && i + 1 < lines.length) {
      const nextLine = lines[i + 1].trim();
      if (isNameLine(nextLine) && !shouldSkipLine(nextLine)) {
        const cents = parseCents(line.replace(/^\$/, ""));
        if (cents !== null) {
          items.push({
            id: makeId(),
            name: nextLine,
            quantity: 1,
            priceCents: cents,
            assignedTo: [],
          });
          i++; // skip the name line
          continue;
        }
      }
    }
```

**Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: All tests pass (18 + 2 = 20)

**Step 5: Commit**

```bash
git add src/lib/parser.ts src/lib/__tests__/parser.test.ts
git commit -m "feat: support non-ASCII names and price-then-name multi-line"
```

---

### Task 3: Add Pattern 5 — `@` quantity separator

**Files:**
- Modify: `src/lib/__tests__/parser.test.ts`
- Modify: `src/lib/parser.ts`

**Step 1: Write the failing test**

Add inside `describe("parseReceiptText", ...)`:

```typescript
  it("parses @ quantity separator (unit price)", () => {
    const items = parseReceiptText("Coffee 2 @ $4.50 $9.00");
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      name: "Coffee",
      quantity: 2,
      priceCents: 450,
    });
  });
```

**Step 2: Run tests to verify it fails**

Run: `npm test`
Expected: FAIL — no pattern matches `@` format.

**Step 3: Implement Pattern 5**

In `parseReceiptText()`, add this new pattern **before** Pattern 3 (the generic name+price pattern), after the Pattern 2 block:

```typescript
    // Pattern 5: name qty @ unit_price [total] (e.g., "Coffee 2 @ $4.50 $9.00")
    match = line.match(
      /^(.+?)\s+(\d+)\s*@\s*\$?([\d,]+(?:\.\d{1,2})?)(?:\s+\$?[\d,]+(?:\.\d{1,2})?)?\s*$/
    );
    if (match) {
      const qty = parseInt(match[2], 10);
      const cents = parseCents(match[3]);
      if (cents !== null && qty >= 1 && qty <= 99) {
        items.push({
          id: makeId(),
          name: match[1].trim(),
          quantity: qty,
          priceCents: cents,
          assignedTo: [],
        });
        continue;
      }
    }
```

**Step 4: Run tests to verify it passes**

Run: `npm test`
Expected: All tests pass (20 + 1 = 21)

**Step 5: Commit**

```bash
git add src/lib/parser.ts src/lib/__tests__/parser.test.ts
git commit -m "feat: add Pattern 5 — @ quantity separator"
```

---

### Task 4: Add Pattern 6 — dot/dash leader

**Files:**
- Modify: `src/lib/__tests__/parser.test.ts`
- Modify: `src/lib/parser.ts`

**Step 1: Write the failing tests**

Add inside `describe("parseReceiptText", ...)`:

```typescript
  it("parses dot-leader lines", () => {
    const items = parseReceiptText("Burger........12.99");
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      name: "Burger",
      priceCents: 1299,
    });
  });

  it("parses dash-leader lines", () => {
    const items = parseReceiptText("Fries --- 4.50");
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      name: "Fries",
      priceCents: 450,
    });
  });
```

**Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — dot/dash leaders not stripped.

**Step 3: Implement Pattern 6**

Add this pattern after Pattern 5, before Pattern 3:

```typescript
    // Pattern 6: dot/dash leader (e.g., "Burger........12.99" or "Fries --- 4.50")
    match = line.match(
      /^(.+?)\s*[.·\-]{2,}\s*\$?([\d,]+(?:\.\d{1,2})?)\s*$/
    );
    if (match) {
      const name = match[1].trim();
      if (name && /^[^\d$]/.test(name)) {
        const cents = parseCents(match[2]);
        if (cents !== null) {
          items.push({
            id: makeId(),
            name,
            quantity: 1,
            priceCents: cents,
            assignedTo: [],
          });
          continue;
        }
      }
    }
```

**Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: All tests pass (21 + 2 = 23)

**Step 5: Commit**

```bash
git add src/lib/parser.ts src/lib/__tests__/parser.test.ts
git commit -m "feat: add Pattern 6 — dot/dash leader"
```

---

### Task 5: Add Pattern 7 — `#`/digit-prefixed items

**Files:**
- Modify: `src/lib/__tests__/parser.test.ts`
- Modify: `src/lib/parser.ts`

**Step 1: Write the failing tests**

Add inside `describe("parseReceiptText", ...)`:

```typescript
  it("parses #-prefixed item names", () => {
    const items = parseReceiptText("#1 Combo Meal 12.99");
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      name: "Combo Meal",
      priceCents: 1299,
    });
  });

  it("parses digit-dot-prefixed item names", () => {
    const items = parseReceiptText("2. Pad Thai 14.50");
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      name: "Pad Thai",
      priceCents: 1450,
    });
  });
```

**Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `#1 Combo Meal` starts with `#` so won't match current patterns.

**Step 3: Implement Pattern 7**

Add this pattern after Pattern 6, before Pattern 3:

```typescript
    // Pattern 7: #/digit-prefixed items (e.g., "#1 Combo Meal 12.99" or "2. Pad Thai 14.50")
    match = line.match(
      /^(?:#\d+|\d+\.)\s+(.+?)\s+\$?([\d,]+(?:\.\d{1,2})?)\s*$/
    );
    if (match) {
      const name = match[1].trim();
      if (name) {
        const cents = parseCents(match[2]);
        if (cents !== null) {
          items.push({
            id: makeId(),
            name,
            quantity: 1,
            priceCents: cents,
            assignedTo: [],
          });
          continue;
        }
      }
    }
```

**Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: All tests pass (23 + 2 = 25)

**Step 5: Commit**

```bash
git add src/lib/parser.ts src/lib/__tests__/parser.test.ts
git commit -m "feat: add Pattern 7 — #/digit-prefixed items"
```

---

### Task 6: Final verification

**Files:**
- No new files

**Step 1: Run full test suite**

Run: `npm test`
Expected: All 25 tests pass (14 existing parser + 11 new parser + image tests)

**Step 2: Run build**

Run: `npm run build`
Expected: Clean build, no TypeScript errors

**Step 3: Verify the real Google Vision test still works**

The existing test "handles real Google Vision receipt output" at line 146 should still pass and parse >= 5 items from the Wasabi Bistro receipt.

**Step 4: Commit (if any fixups needed)**

Only if Steps 1-3 revealed issues that needed fixing.
