# Print/PDF Export Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the PDF export (Save as PDF) produce a clean, light-background, two-page receipt: page 1 is the split summary, page 2 is the original item list.

**Architecture:** Add comprehensive `@media print` CSS to override dark theme colors for print, add CSS classes to hide interactive-only sections, create a print-only `PrintItemsList` component for page 2, and add `break-inside: avoid` rules to prevent awkward page breaks.

**Tech Stack:** CSS `@media print`, Tailwind utility classes, one new React component.

---

### Task 1: Add print visibility CSS classes and update globals.css

**Files:**
- Modify: `src/app/globals.css`

**Step 1: Rewrite the `@media print` block in globals.css**

Replace the existing `@media print` block (lines 31-46) with comprehensive print styles:

```css
@media print {
  /* Hide interactive/screen-only elements */
  .no-print {
    display: none !important;
  }

  /* Show print-only elements */
  .print-only {
    display: block !important;
  }

  /* Light background, dark text */
  body {
    background: white !important;
    color: #171717 !important;
    font-size: 11pt;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  /* Keep receipt-width column, add print margins */
  main {
    padding: 0 2rem !important;
    max-width: 28rem !important;
    margin: 0 auto !important;
  }

  /* Receipt tape container: remove dark bg, shadow, torn edges */
  .receipt-tape {
    background: transparent !important;
    box-shadow: none !important;
  }

  .receipt-tape .torn-edge {
    display: none !important;
  }

  /* Section separators: light gray instead of zinc-700 */
  .receipt-section {
    border-color: #d1d5db !important;
    padding-top: 0.75rem !important;
    padding-bottom: 0.75rem !important;
  }

  /* Override all dark text colors to print-friendly values */
  .receipt-tape * {
    color: #171717 !important;
  }

  .receipt-tape .print-muted {
    color: #6b7280 !important;
  }

  /* Decorative separators */
  .receipt-tape .print-decorative {
    color: #9ca3af !important;
  }

  /* Keep person color dots visible */
  .receipt-tape .person-dot {
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  /* Page break rules */
  .print-no-break {
    break-inside: avoid;
  }

  .print-page-break {
    break-before: page;
  }

  .print-keep-with-next {
    break-after: avoid;
  }
}
```

**Step 2: Add the `.print-only` base rule outside the print block**

Add this rule after the `body { ... }` block and before the `@media print` block:

```css
.print-only {
  display: none;
}
```

This ensures print-only elements are hidden on screen by default.

**Step 3: Build and verify**

Run: `npm run build`
Expected: Builds successfully.

**Step 4: Commit**

```bash
git add src/app/globals.css
git commit -m "feat: comprehensive print CSS with light theme and page break rules"
```

---

### Task 2: Add print CSS hooks to existing components

**Files:**
- Modify: `src/components/receipt/ReceiptTape.tsx`
- Modify: `src/components/receipt/Section.tsx`
- Modify: `src/components/receipt/SplitSection.tsx`
- Modify: `src/components/receipt/TotalsSection.tsx`
- Modify: `src/components/receipt/ReceiptHeader.tsx`

**Step 1: Add CSS class hooks to ReceiptTape**

Add `receipt-tape` class to the outer div. Add `torn-edge` class to both torn edge divs:

In `ReceiptTape.tsx`, change:
- Outer div: add `receipt-tape` to className
- Top torn edge div: add `torn-edge` to className
- Bottom torn edge div: add `torn-edge` to className

```tsx
interface ReceiptTapeProps {
  children: React.ReactNode;
}

export function ReceiptTape({ children }: ReceiptTapeProps) {
  return (
    <div className="receipt-tape relative mx-auto w-full rounded-sm bg-zinc-900 shadow-2xl shadow-black/50">
      {/* Torn top edge */}
      <div
        className="torn-edge h-3 w-full bg-zinc-900"
        style={{
          clipPath:
            "polygon(0% 100%, 2% 40%, 4% 100%, 6% 40%, 8% 100%, 10% 40%, 12% 100%, 14% 40%, 16% 100%, 18% 40%, 20% 100%, 22% 40%, 24% 100%, 26% 40%, 28% 100%, 30% 40%, 32% 100%, 34% 40%, 36% 100%, 38% 40%, 40% 100%, 42% 40%, 44% 100%, 46% 40%, 48% 100%, 50% 40%, 52% 100%, 54% 40%, 56% 100%, 58% 40%, 60% 100%, 62% 40%, 64% 100%, 66% 40%, 68% 100%, 70% 40%, 72% 100%, 74% 40%, 76% 100%, 78% 40%, 80% 100%, 82% 40%, 84% 100%, 86% 40%, 88% 100%, 90% 40%, 92% 100%, 94% 40%, 96% 100%, 98% 40%, 100% 100%)",
        }}
        aria-hidden="true"
      />

      <div className="px-5">
        {children}
      </div>

      {/* Torn bottom edge */}
      <div
        className="torn-edge h-3 w-full bg-zinc-900"
        style={{
          clipPath:
            "polygon(0% 0%, 2% 60%, 4% 0%, 6% 60%, 8% 0%, 10% 60%, 12% 0%, 14% 60%, 16% 0%, 18% 60%, 20% 0%, 22% 60%, 24% 0%, 26% 60%, 28% 0%, 30% 60%, 32% 0%, 34% 60%, 36% 0%, 38% 60%, 40% 0%, 42% 60%, 44% 0%, 46% 60%, 48% 0%, 50% 60%, 52% 0%, 54% 60%, 56% 0%, 58% 60%, 60% 0%, 62% 60%, 64% 0%, 66% 60%, 68% 0%, 70% 60%, 72% 0%, 74% 60%, 76% 0%, 78% 60%, 80% 0%, 82% 60%, 84% 0%, 86% 60%, 88% 0%, 90% 60%, 92% 0%, 94% 60%, 96% 0%, 98% 60%, 100% 0%)",
        }}
        aria-hidden="true"
      />
    </div>
  );
}
```

**Step 2: Add `receipt-section` class to Section component**

```tsx
interface SectionProps {
  children: React.ReactNode;
  className?: string;
}

export function Section({ children, className }: SectionProps) {
  return (
    <div className={`receipt-section border-b border-dashed border-zinc-700 py-5 last:border-0 ${className ?? ""}`}>
      {children}
    </div>
  );
}
```

**Step 3: Add print classes to SplitSection**

Add `print-no-break` to each `PersonSplit` wrapper div (the `space-y-1` div). Add `print-muted` to muted text elements. Add `print-decorative` to the "——— SPLIT ———" text. Add `person-dot` to person color dots.

In SplitSection.tsx, update:

```tsx
"use client";

import { PersonBreakdown } from "@/types";
import { formatCents } from "@/lib/format";
import { Section } from "./Section";

interface SplitSectionProps {
  breakdowns: PersonBreakdown[];
}

export function SplitSection({ breakdowns }: SplitSectionProps) {
  if (breakdowns.length === 0 || breakdowns.every((b) => b.totalCents === 0)) {
    return null;
  }

  return (
    <Section>
      <div className="print-decorative mb-3 text-center font-mono text-xs text-zinc-600 select-none" aria-hidden="true">
        ——— SPLIT ———
      </div>
      <div className="space-y-4">
        {breakdowns.map((breakdown) => (
          <PersonSplit key={breakdown.person.id} breakdown={breakdown} />
        ))}
      </div>
    </Section>
  );
}

function PersonSplit({ breakdown }: { breakdown: PersonBreakdown }) {
  const { person, items, subtotalCents, taxShareCents, tipShareCents, totalCents } = breakdown;

  if (totalCents === 0) return null;

  return (
    <div className="print-no-break space-y-1">
      {/* Person header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className="person-dot inline-block h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: person.color }}
          />
          <span className="text-sm font-semibold text-zinc-200">{person.name}</span>
        </div>
        <span className="font-mono text-sm font-bold text-zinc-100">
          {formatCents(totalCents)}
        </span>
      </div>

      {/* Item breakdown */}
      <div className="space-y-0.5 pl-5">
        {items.map(({ item, shareCents, splitCount }) => (
          <div key={item.id} className="flex justify-between font-mono text-xs text-zinc-500 print-muted">
            <span className="truncate">
              {item.name}
              {splitCount > 1 && (
                <span className="text-zinc-600"> (1/{splitCount})</span>
              )}
            </span>
            <span className="ml-2">{formatCents(shareCents)}</span>
          </div>
        ))}
        {taxShareCents > 0 && (
          <div className="flex justify-between font-mono text-xs text-zinc-500 print-muted">
            <span>tax</span>
            <span>{formatCents(taxShareCents)}</span>
          </div>
        )}
        {tipShareCents > 0 && (
          <div className="flex justify-between font-mono text-xs text-zinc-500 print-muted">
            <span>tip</span>
            <span>{formatCents(tipShareCents)}</span>
          </div>
        )}
      </div>
    </div>
  );
}
```

**Step 4: Add print classes to TotalsSection**

Add `print-no-break` to the `Section` wrapper, `print-muted` to muted labels, `print-decorative` to the `================================` line:

```tsx
"use client";

import { ReceiptItem, TaxTip } from "@/types";
import { formatCents } from "@/lib/format";
import { getSubtotalCents, getEffectiveTaxCents, getEffectiveTipCents } from "@/lib/calculator";
import { Section } from "./Section";

interface TotalsSectionProps {
  items: ReceiptItem[];
  taxTip: TaxTip;
}

export function TotalsSection({ items, taxTip }: TotalsSectionProps) {
  const subtotal = getSubtotalCents(items);
  const tax = getEffectiveTaxCents(taxTip, subtotal);
  const tip = getEffectiveTipCents(taxTip, subtotal);
  const total = subtotal + tax + tip;

  if (items.length === 0) return null;

  return (
    <Section>
      <div className="print-no-break space-y-1.5 font-mono text-sm">
        <div className="flex justify-between text-zinc-400 print-muted">
          <span>SUBTOTAL</span>
          <span className="text-zinc-300">{formatCents(subtotal)}</span>
        </div>
        <div className="flex justify-between text-zinc-400 print-muted">
          <span>
            TAX{taxTip.taxIsPercent ? ` (${taxTip.taxPercent}%)` : ""}
          </span>
          <span className="text-zinc-300">{formatCents(tax)}</span>
        </div>
        <div className="flex justify-between text-zinc-400 print-muted">
          <span>
            TIP{taxTip.tipIsPercent ? ` (${taxTip.tipPercent}%)` : ""}
          </span>
          <span className="text-zinc-300">{formatCents(tip)}</span>
        </div>
        <div className="print-decorative text-xs text-zinc-600 select-none" aria-hidden="true">
          ================================
        </div>
        <div className="flex justify-between text-base font-bold text-zinc-100">
          <span>TOTAL</span>
          <span>{formatCents(total)}</span>
        </div>
      </div>
    </Section>
  );
}
```

**Step 5: Add `print-keep-with-next` to ReceiptHeader**

Add the class to the header's outer div:

```tsx
"use client";

import { useState } from "react";

export function ReceiptHeader() {
  const [timestamp] = useState(() => {
    const now = new Date();
    return `${now.toLocaleDateString("en-US", {
      month: "2-digit",
      day: "2-digit",
      year: "numeric",
    })} ${now.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    })}`;
  });

  return (
    <div className="print-keep-with-next py-6 text-center">
      <h1 className="font-mono text-lg font-bold uppercase tracking-[0.25em] text-zinc-100">
        Receipt Split
      </h1>
      <div className="print-decorative mt-1 font-mono text-xs text-zinc-600 select-none" aria-hidden="true">
        ================================
      </div>
      <p className="print-muted mt-2 font-mono text-xs text-zinc-500">
        {timestamp}
      </p>
    </div>
  );
}
```

**Step 6: Commit**

```bash
git add src/components/receipt/ReceiptTape.tsx src/components/receipt/Section.tsx src/components/receipt/SplitSection.tsx src/components/receipt/TotalsSection.tsx src/components/receipt/ReceiptHeader.tsx
git commit -m "feat: add print CSS hooks to receipt components"
```

---

### Task 3: Hide interactive sections in print and create PrintItemsList

**Files:**
- Modify: `src/app/page.tsx`
- Create: `src/components/receipt/PrintItemsList.tsx`

**Step 1: Create PrintItemsList component**

This is a print-only component that renders the full item list in receipt-line format on a separate page.

Create `src/components/receipt/PrintItemsList.tsx`:

```tsx
import { ReceiptItem } from "@/types";
import { formatCents } from "@/lib/format";
import { getSubtotalCents } from "@/lib/calculator";

interface PrintItemsListProps {
  items: ReceiptItem[];
}

export function PrintItemsList({ items }: PrintItemsListProps) {
  if (items.length === 0) return null;

  const subtotal = getSubtotalCents(items);

  return (
    <div className="print-only print-page-break">
      <h3 className="print-muted mb-3 text-xs font-medium uppercase tracking-wider">
        Items
      </h3>
      <div className="space-y-1">
        {items.map((item) => {
          const total = item.quantity * item.priceCents;
          return (
            <div key={item.id} className="flex items-center gap-2 font-mono text-sm">
              <span className="print-muted w-6 shrink-0 text-xs">
                {item.quantity}×
              </span>
              <span className="min-w-0 flex-1 truncate">{item.name}</span>
              <span className="shrink-0">{formatCents(total)}</span>
            </div>
          );
        })}
      </div>
      <div className="print-decorative mt-2 text-xs" aria-hidden="true">
        ================================
      </div>
      <div className="mt-1 flex justify-between font-mono text-sm font-bold">
        <span>SUBTOTAL</span>
        <span>{formatCents(subtotal)}</span>
      </div>
    </div>
  );
}
```

**Step 2: Update page.tsx to hide interactive sections in print and add PrintItemsList**

Add `no-print` class to: ScanSection wrapper, PeopleSection wrapper, ItemsSection wrapper, unassigned warning div, TaxTipSection wrapper.

Add the `PrintItemsList` component at the end (inside ReceiptTape, after ShareSection).

```tsx
"use client";

import { useReceipt } from "@/hooks/useReceipt";
import { calculateBreakdowns } from "@/lib/calculator";
import { generateShareText, generateCsv } from "@/lib/format";
import { ReceiptTape } from "@/components/receipt/ReceiptTape";
import { ReceiptHeader } from "@/components/receipt/ReceiptHeader";
import { ScanSection } from "@/components/receipt/ScanSection";
import { PeopleSection } from "@/components/receipt/PeopleSection";
import { ItemsSection } from "@/components/receipt/ItemsSection";
import { TaxTipSection } from "@/components/receipt/TaxTipSection";
import { TotalsSection } from "@/components/receipt/TotalsSection";
import { SplitSection } from "@/components/receipt/SplitSection";
import { ShareSection } from "@/components/receipt/ShareSection";
import { PrintItemsList } from "@/components/receipt/PrintItemsList";

export default function ReceiptPage() {
  const receipt = useReceipt();

  const hasItems = receipt.items.length > 0;
  const hasPeople = receipt.people.length > 0;
  const allAssigned =
    hasItems && receipt.items.every((item) => item.assignedTo.length > 0);

  const breakdowns =
    hasItems && hasPeople
      ? calculateBreakdowns(receipt.items, receipt.people, receipt.taxTip)
      : [];

  const shareText =
    breakdowns.length > 0
      ? generateShareText(receipt.items, receipt.taxTip, breakdowns)
      : "";

  const csvText =
    breakdowns.length > 0
      ? generateCsv(receipt.items, receipt.taxTip, breakdowns)
      : "";

  const unassignedCount = receipt.items.filter(
    (item) => item.assignedTo.length === 0
  ).length;

  function handleScanComplete() {
    // Items are already set via context
  }

  function handleSkipScan() {
    if (receipt.items.length === 0) {
      receipt.addItem("New Item", 1, 0);
    }
  }

  function handleStartOver() {
    receipt.reset();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <ReceiptTape>
      <ReceiptHeader />

      {!hasItems && (
        <div className="no-print">
          <ScanSection onComplete={handleScanComplete} onSkip={handleSkipScan} />
        </div>
      )}

      {hasItems && (
        <div className="no-print">
          <PeopleSection
            people={receipt.people}
            onAdd={receipt.addPerson}
            onUpdate={receipt.updatePerson}
            onDelete={receipt.deletePerson}
          />
        </div>
      )}

      {hasItems && (
        <div className="no-print">
          <ItemsSection
            items={receipt.items}
            people={receipt.people}
            onUpdate={receipt.updateItem}
            onDelete={receipt.deleteItem}
            onToggleAssignment={receipt.toggleAssignment}
            onAddItem={() => receipt.addItem("New Item", 1, 0)}
          />
        </div>
      )}

      {hasItems && hasPeople && !allAssigned && unassignedCount > 0 && (
        <div className="no-print py-2 text-center font-mono text-xs text-amber-500">
          {unassignedCount} item{unassignedCount !== 1 ? "s" : ""} unassigned
        </div>
      )}

      {hasItems && (
        <div className="no-print">
          <TaxTipSection taxTip={receipt.taxTip} onChange={receipt.setTaxTip} />
        </div>
      )}

      {hasItems && (
        <TotalsSection items={receipt.items} taxTip={receipt.taxTip} />
      )}

      {allAssigned && hasPeople && (
        <SplitSection breakdowns={breakdowns} />
      )}

      {allAssigned && hasPeople && (
        <ShareSection
          shareText={shareText}
          csvText={csvText}
          onStartOver={handleStartOver}
        />
      )}

      {/* Print-only: full item list on page 2 */}
      {hasItems && (
        <PrintItemsList items={receipt.items} />
      )}
    </ReceiptTape>
  );
}
```

**Step 3: Build and verify**

Run: `npm run build`
Expected: Builds successfully.

**Step 4: Commit**

```bash
git add src/app/page.tsx src/components/receipt/PrintItemsList.tsx
git commit -m "feat: hide interactive sections in print, add print-only items list on page 2"
```

---

### Task 4: Verify tests, build, and visual check

**Files:**
- No new files

**Step 1: Run tests**

Run: `npm test`
Expected: All 26 tests pass.

**Step 2: Run build**

Run: `npm run build`
Expected: Clean build.

**Step 3: Visual verification**

Run: `npm run dev`

Verify on-screen:
- PrintItemsList is NOT visible on screen (hidden by `.print-only { display: none }`)
- All interactive sections still work as before
- No visual regressions

Verify in print preview (Cmd+P or use the PDF button):
- Page 1: Header + Totals + Split summary on white background
- Page 2: Items list with subtotal
- Interactive sections (scan, people, items editor, tax/tip editor, share) are hidden
- Person color dots are visible
- Monospace numbers are preserved
- No sections are cut awkwardly across page boundaries

**Step 4: Commit (only if fixes needed)**

```bash
git add -A
git commit -m "fix: print export visual adjustments"
```
