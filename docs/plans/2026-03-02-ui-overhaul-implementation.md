# UI Overhaul — Skeuomorphic Receipt Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform the dark-themed receipt UI into a skeuomorphic cream-paper receipt with VT323 thermal font, Caveat handwritten annotations, SVG pen strikethrough swipe-to-delete, and dot-leader item formatting. All functionality stays identical.

**Architecture:** Pure styling overhaul — every component keeps its props, state, and behavior. We swap Tailwind classes, CSS variables, and fonts. The swipe-to-delete is the only logic change (SVG strikethrough replaces the red delete button). We work bottom-up: foundation first (fonts, colors, CSS), then leaf components, then composite components.

**Tech Stack:** Next.js (App Router), Tailwind CSS 4, Google Fonts (VT323, Caveat), SVG for strikethrough effect.

---

### Task 1: Fonts — Add VT323 and Caveat via next/font

**Files:**
- Modify: `src/app/layout.tsx` (lines 1-42)

**Step 1: Update layout.tsx to import VT323 and Caveat from next/font/google**

Replace the Geist font imports with VT323 and Caveat. Keep Geist as a fallback (it's the system default). Add CSS custom properties for the two new font families.

```tsx
import { VT323, Caveat } from "next/font/google";

const vt323 = VT323({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-receipt",
});

const caveat = Caveat({
  subsets: ["latin"],
  variable: "--font-handwritten",
});
```

Update the `<body>` className to include both font variables:

```tsx
<body className={`${vt323.variable} ${caveat.variable} antialiased bg-[var(--page-bg)] text-[var(--ink)]`}>
```

Keep the `<html lang="en" className="dark">` — we may still use dark class for print toggling.

Keep `<main className="mx-auto min-h-screen max-w-md px-4 py-6">`.

**Step 2: Verify the dev server loads both fonts**

Run: `npm run dev`
Expected: No build errors; fonts loaded in browser Network tab.

**Step 3: Commit**

```bash
git add src/app/layout.tsx
git commit -m "feat: add VT323 and Caveat fonts via next/font"
```

---

### Task 2: CSS Foundation — Color palette, paper texture, receipt typography

**Files:**
- Modify: `src/app/globals.css` (lines 1-112)

**Step 1: Replace CSS custom properties with the new receipt palette**

Replace the existing `:root` / `@theme inline` block. The new palette:

```css
@theme inline {
  --color-page-bg: #1a1a1a;
  --color-paper: #faf5e8;
  --color-ink: #2d2517;
  --color-ink-muted: #8c7e6a;
  --color-ink-faded: #c4b9a8;
  --color-separator: #d4c9b8;
  --color-accent: #c0392b;
  --color-accent-muted: #c0392b40;

  /* Keep old tokens mapped for any missed references */
  --color-background: #1a1a1a;
  --color-foreground: #2d2517;

  /* Font families from next/font CSS variables */
  --font-receipt: var(--font-receipt);
  --font-handwritten: var(--font-handwritten);
}
```

**Step 2: Add utility classes for receipt typography**

```css
/* Receipt base font — thermal printer style */
.font-receipt {
  font-family: var(--font-receipt), monospace;
}

/* Handwritten annotation font */
.font-hand {
  font-family: var(--font-handwritten), cursive;
}

/* Paper noise texture (pure CSS, no images) */
.paper-texture {
  background-color: var(--color-paper);
  background-image:
    repeating-linear-gradient(
      0deg,
      transparent,
      transparent 2px,
      rgba(0, 0, 0, 0.01) 2px,
      rgba(0, 0, 0, 0.01) 4px
    );
}

/* Dot leader utility — fills space between flex children */
.dot-leader::after {
  content: "";
  flex: 1;
  border-bottom: 2px dotted var(--color-ink-faded);
  margin: 0 4px;
  margin-bottom: 4px;
}

/* Character separator — printed dashes */
.receipt-separator {
  font-family: var(--font-receipt), monospace;
  color: var(--color-separator);
  user-select: none;
  text-align: center;
  letter-spacing: 0.1em;
}

/* Strikethrough animation for swipe-to-delete */
.strikethrough-line {
  stroke: var(--color-accent);
  stroke-width: 2;
  stroke-linecap: round;
  fill: none;
}
```

**Step 3: Update print styles**

The print styles should keep working — update color references from zinc to the new tokens. Receipt paper becomes white in print, ink stays dark. Most existing print rules stay the same — just update the color values.

```css
@media print {
  body {
    background: white !important;
    color: #2d2517 !important;
  }
  .receipt-tape {
    background: white !important;
    box-shadow: none !important;
  }
  /* Keep existing .no-print, .print-only, .print-muted, .print-no-break rules */
}
```

**Step 4: Run dev server to verify CSS loads**

Run: `npm run dev`
Expected: Page background changes to dark charcoal.

**Step 5: Commit**

```bash
git add src/app/globals.css
git commit -m "feat: receipt color palette, paper texture, and typography utilities"
```

---

### Task 3: ReceiptTape — Cream paper with refined torn edges

**Files:**
- Modify: `src/components/receipt/ReceiptTape.tsx` (lines 1-33)

**Step 1: Update ReceiptTape styling**

Change from dark zinc-900 to cream paper with texture:

```tsx
export function ReceiptTape({ children }: { children: React.ReactNode }) {
  return (
    <div className="receipt-tape relative mx-auto w-full">
      {/* Top torn edge */}
      <div
        className="torn-edge h-4 w-full bg-paper"
        aria-hidden="true"
        style={{
          clipPath:
            "polygon(0% 60%, 2% 40%, 4% 65%, 6% 35%, 8% 60%, 10% 40%, 12% 55%, 14% 35%, 16% 60%, 18% 45%, 20% 65%, 22% 35%, 24% 55%, 26% 40%, 28% 60%, 30% 35%, 32% 55%, 34% 40%, 36% 65%, 38% 35%, 40% 55%, 42% 40%, 44% 60%, 46% 35%, 48% 55%, 50% 40%, 52% 60%, 54% 35%, 56% 55%, 58% 40%, 60% 65%, 62% 35%, 64% 55%, 66% 40%, 68% 60%, 70% 35%, 72% 55%, 74% 40%, 76% 65%, 78% 35%, 80% 55%, 82% 40%, 84% 60%, 86% 35%, 88% 55%, 90% 40%, 92% 60%, 94% 35%, 96% 55%, 98% 40%, 100% 60%, 100% 100%, 0% 100%)",
        }}
      />
      {/* Receipt body */}
      <div className="paper-texture px-5 pb-6 shadow-xl shadow-black/30">
        {children}
      </div>
      {/* Bottom torn edge */}
      <div
        className="torn-edge h-4 w-full bg-paper"
        aria-hidden="true"
        style={{
          clipPath:
            "polygon(0% 0%, 100% 0%, 100% 40%, 98% 60%, 96% 45%, 94% 65%, 92% 40%, 90% 60%, 88% 45%, 86% 65%, 84% 40%, 82% 60%, 80% 45%, 78% 65%, 76% 40%, 74% 60%, 72% 45%, 70% 65%, 68% 40%, 66% 55%, 64% 45%, 62% 65%, 60% 40%, 58% 60%, 56% 45%, 54% 65%, 52% 40%, 50% 60%, 48% 45%, 46% 65%, 44% 40%, 42% 55%, 40% 45%, 38% 65%, 36% 40%, 34% 60%, 32% 45%, 30% 65%, 28% 40%, 26% 55%, 24% 45%, 22% 65%, 20% 40%, 18% 60%, 16% 45%, 14% 65%, 12% 40%, 10% 55%, 8% 45%, 6% 65%, 4% 40%, 2% 60%, 0% 40%)",
        }}
      />
    </div>
  );
}
```

The zigzag pattern is denser/more regular than the current wavy pattern — mimics perforated thermal paper.

**Step 2: Verify receipt renders with cream background and torn edges**

Run: `npm run dev`
Expected: Receipt appears as cream-colored paper on dark background with zigzag edges.

**Step 3: Commit**

```bash
git add src/components/receipt/ReceiptTape.tsx
git commit -m "feat: cream paper receipt tape with zigzag torn edges"
```

---

### Task 4: Section — Character-based separators

**Files:**
- Modify: `src/components/receipt/Section.tsx` (lines 1-12)

**Step 1: Replace CSS border with character separator**

```tsx
export function Section({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`receipt-section py-4 ${className}`}>
      {children}
      <div className="receipt-separator mt-4 text-sm last:hidden" aria-hidden="true">
        - - - - - - - - - - - - - - - - - - -
      </div>
    </div>
  );
}
```

Remove the CSS `border-b border-dashed border-zinc-700` — separators are now receipt characters. Use `:last-child` CSS or `last:hidden` to hide the final separator.

**Step 2: Commit**

```bash
git add src/components/receipt/Section.tsx
git commit -m "feat: character-based receipt separators"
```

---

### Task 5: ReceiptHeader — Thermal-style header

**Files:**
- Modify: `src/components/receipt/ReceiptHeader.tsx` (lines 1-69)

**Step 1: Restyle header to receipt aesthetic**

Update all Tailwind classes:

- Restaurant name input/heading: `w-full bg-transparent text-center font-receipt text-2xl uppercase tracking-[0.15em] text-ink focus:outline-none` (VT323 via font-receipt, larger for readability, ink color on cream)
- Timestamp: `mt-1 font-receipt text-base text-ink-muted` (bigger since VT323 is small)
- Separator: `receipt-separator mt-2 text-sm` with `================================` text
- Container: `py-6 text-center`

Remove all `text-zinc-*` references. Replace with `text-ink`, `text-ink-muted`, etc.

**Step 2: Commit**

```bash
git add src/components/receipt/ReceiptHeader.tsx
git commit -m "feat: thermal-style receipt header"
```

---

### Task 6: PeopleSection — Colored initial circles with Caveat font

**Files:**
- Modify: `src/components/receipt/PeopleSection.tsx` (lines 1-131)

**Step 1: Restyle people section**

Key class changes:
- Section header: `font-receipt text-base uppercase tracking-wider text-ink-muted` (was `text-xs font-medium uppercase tracking-wider text-zinc-500`)
- Person circles: replace pill buttons with `w-10 h-10 rounded-full flex items-center justify-center font-hand text-lg font-bold`
  - Active: solid `backgroundColor` from person.color, `color: #faf5e8` (paper color for contrast), `boxShadow: 0 0 0 3px ${color}40`
  - Inactive: `border-2` with person color, `color` = person color, `backgroundColor: transparent`
- Add button: `w-10 h-10 rounded-full border-2 border-dashed border-ink-faded flex items-center justify-center font-receipt text-lg text-ink-faded`
- Add input: `border-b-2 border-ink-faded bg-transparent font-hand text-lg text-ink focus:border-ink focus:outline-none` (underlined blank style)
- Edit input: same underlined style
- Hint text: `mt-2 text-center font-hand text-lg` with person's color as inline style
- Item count on circle: small `font-receipt text-xs` badge offset below

**Step 2: Commit**

```bash
git add src/components/receipt/PeopleSection.tsx
git commit -m "feat: colored initial circles with handwritten font"
```

---

### Task 7: ItemRow — Dot leaders, pen annotations, SVG strikethrough

This is the biggest task. Split into sub-steps.

**Files:**
- Modify: `src/components/receipt/ItemRow.tsx` (lines 1-331)

**Step 7.1: Restyle collapsed item row with dot leaders and initials**

Replace the current collapsed row layout. The new structure:

```tsx
{/* Collapsed row */}
<button className="flex w-full items-baseline px-0 py-2 text-left font-receipt text-lg text-ink">
  {/* Quantity prefix */}
  {item.quantity > 1 && (
    <span className="shrink-0 text-ink-muted">{item.quantity}x </span>
  )}
  {/* Item name */}
  <span className="shrink-0">{item.name.toUpperCase()}</span>
  {/* Dot leaders */}
  <span className="mx-1 flex-1 overflow-hidden whitespace-nowrap text-ink-faded" aria-hidden="true">
    {"·".repeat(50)}
  </span>
  {/* Price */}
  <span className="shrink-0">{formatCents(item.quantity * item.priceCents)}</span>
</button>
{/* Person initials below */}
<div className="flex gap-2 pb-1 pl-2">
  {assignedPeople.length > 0 ? (
    assignedPeople.map((p) => (
      <span key={p.id} className="font-hand text-base font-bold" style={{ color: p.color }}>
        {p.name.charAt(0).toUpperCase()}
      </span>
    ))
  ) : (
    <span className="font-hand text-base text-ink-faded italic">
      (tap to assign)
    </span>
  )}
</div>
```

Remove:
- The left border indicator (we use initials instead)
- The colored dots display (replaced by initials)
- `bg-zinc-900`, `hover:bg-zinc-800/50` backgrounds (it's cream paper now)
- All `text-zinc-*` classes

**Step 7.2: Add SVG strikethrough for swipe-to-delete**

Replace the red delete button zone with an SVG overlay. The SVG renders a wavy pen line across the item text.

Add a new state: `isStruck: boolean` (true when past threshold).

```tsx
const STRIKE_THRESHOLD_RATIO = 0.4; // 40% of row width

// In the swipe handler, compute whether we've passed threshold:
const rowWidth = rowRef.current?.offsetWidth ?? 300;
const ratio = Math.abs(swipeOffset) / rowWidth;
const shouldStrike = ratio >= STRIKE_THRESHOLD_RATIO;
```

The SVG strikethrough overlay (positioned absolute over the text):

```tsx
{shouldStrike && (
  <svg
    className="pointer-events-none absolute inset-0"
    viewBox="0 0 100 20"
    preserveAspectRatio="none"
    aria-hidden="true"
  >
    <path
      d="M 0,10 Q 5,6 10,10 T 20,10 T 30,10 T 40,10 T 50,10 T 60,10 T 70,10 T 80,10 T 90,10 T 100,10"
      className="strikethrough-line"
      style={{
        strokeDasharray: 200,
        strokeDashoffset: 0,
        transition: "stroke-dashoffset 200ms ease-out",
      }}
    />
  </svg>
)}
```

On release past threshold: keep `isStruck = true`, wait 300ms, then call `onDelete(item.id)` with a height collapse animation.

On release before threshold: snap back, clear `isStruck`.

Remove the old red delete button (`bg-red-600 px-5 text-white`) entirely.

Remove `DELETE_ZONE_WIDTH` and `isSwipeOpen` state — no longer needed.

**Step 7.3: Restyle expanded item edit view**

Replace box inputs with underlined blanks:

```tsx
{/* Expanded edit area */}
<div className="space-y-3 px-2 pb-3 pt-1">
  {/* Name input — underlined blank */}
  <input
    className="w-full border-b-2 border-ink-faded bg-transparent font-receipt text-lg text-ink uppercase focus:border-ink focus:outline-none"
    value={localName}
    onChange={...}
    onBlur={...}
  />
  <div className="flex items-center gap-4">
    {/* Qty input */}
    <label className="font-receipt text-sm text-ink-muted">
      QTY
      <input
        className="ml-2 w-12 border-b-2 border-ink-faded bg-transparent text-center font-receipt text-lg text-ink focus:border-ink focus:outline-none"
        ...
      />
    </label>
    {/* Price input */}
    <label className="font-receipt text-sm text-ink-muted">
      PRICE
      <input
        className="ml-2 w-20 border-b-2 border-ink-faded bg-transparent font-receipt text-lg text-ink focus:border-ink focus:outline-none"
        ...
      />
    </label>
    {/* Delete text button */}
    <button className="ml-auto font-receipt text-sm text-accent underline">
      delete
    </button>
  </div>
  {/* Person assignment circles */}
  <div className="flex flex-wrap items-center gap-2">
    <button className="font-receipt text-xs text-ink-muted underline">
      all/none
    </button>
    {people.map((p) => (
      <button
        key={p.id}
        className="h-8 w-8 rounded-full flex items-center justify-center font-hand text-sm font-bold transition-all"
        style={{
          backgroundColor: isAssigned ? p.color : "transparent",
          color: isAssigned ? "#faf5e8" : p.color,
          border: isAssigned ? "none" : `2px solid ${p.color}`,
        }}
      >
        {p.name.charAt(0).toUpperCase()}
      </button>
    ))}
  </div>
</div>
```

**Step 7.4: Run tests to verify nothing broke**

Run: `npm test`
Expected: All 39 tests pass (parser + calculator + image — no UI tests exist).

**Step 7.5: Commit**

```bash
git add src/components/receipt/ItemRow.tsx
git commit -m "feat: dot-leader items, pen initials, SVG strikethrough delete"
```

---

### Task 8: ItemsSection — Receipt-styled header and add button

**Files:**
- Modify: `src/components/receipt/ItemsSection.tsx` (lines 1-69)

**Step 1: Restyle items section**

- Header label: `font-receipt text-base uppercase text-ink-muted`
- Item count: `font-receipt text-base text-ink-faded`
- Add button: `font-receipt text-base text-ink-muted underline` (was amber)
- Empty state: `py-6 text-center font-receipt text-base text-ink-faded`
- Remove the `-mx-3` negative margin (no longer needed without the left border indicator)

**Step 2: Commit**

```bash
git add src/components/receipt/ItemsSection.tsx
git commit -m "feat: receipt-styled items header"
```

---

### Task 9: TaxTipSection — Compact receipt rows with tap-to-expand

**Files:**
- Modify: `src/components/receipt/TaxTipSection.tsx` (lines 1-165)

**Step 1: Restyle tax/tip section**

Key changes:
- Section header: removed (tax/tip rows are self-explanatory on a receipt)
- Collapsed row: `flex w-full items-center justify-between font-receipt text-lg text-ink` with dot leaders between label and amount
- Expanded presets: `font-receipt text-base` buttons, active = `font-bold underline text-ink`, inactive = `text-ink-muted`
- Mode toggle (`%` / `$`): `font-receipt text-sm`, active = `text-ink font-bold`, inactive = `text-ink-faded`
- Custom input: `border-b-2 border-ink-faded bg-transparent font-receipt text-lg text-ink focus:border-ink focus:outline-none`
- Replace all `bg-amber-*`, `bg-zinc-*`, `text-zinc-*` classes

**Step 2: Commit**

```bash
git add src/components/receipt/TaxTipSection.tsx
git commit -m "feat: receipt-styled tax and tip rows"
```

---

### Task 10: TotalsSection — Classic receipt totals with dot leaders

**Files:**
- Modify: `src/components/receipt/TotalsSection.tsx` (lines 1-50)

**Step 1: Restyle totals**

```tsx
<div className="print-no-break space-y-1 font-receipt text-lg">
  <div className="receipt-separator text-sm" aria-hidden="true">
    ================================
  </div>
  {/* Subtotal, Tax, Tip lines */}
  <div className="flex items-baseline text-ink-muted">
    <span>SUBTOTAL</span>
    <span className="mx-1 flex-1 overflow-hidden whitespace-nowrap text-ink-faded" aria-hidden="true">
      {"·".repeat(50)}
    </span>
    <span>{formatCents(subtotalCents)}</span>
  </div>
  {/* ... same for TAX, TIP ... */}
  <div className="receipt-separator text-sm" aria-hidden="true">
    ================================
  </div>
  <div className="flex items-baseline text-xl font-bold text-ink">
    <span>TOTAL</span>
    <span className="mx-1 flex-1 overflow-hidden whitespace-nowrap text-ink-faded" aria-hidden="true">
      {"·".repeat(50)}
    </span>
    <span>{formatCents(grandTotal)}</span>
  </div>
  <div className="receipt-separator text-sm" aria-hidden="true">
    ================================
  </div>
</div>
```

**Step 2: Commit**

```bash
git add src/components/receipt/TotalsSection.tsx
git commit -m "feat: classic receipt totals with dot leaders"
```

---

### Task 11: SplitSection — Per-person breakdown with circles

**Files:**
- Modify: `src/components/receipt/SplitSection.tsx` (lines 1-79)

**Step 1: Restyle split section**

- Header: `receipt-separator` with `- - - - - SPLIT - - - - -`
- Person header row: colored circle (same as PeopleSection) + `font-hand text-xl font-bold` name + `font-receipt text-lg font-bold` total
- Item breakdown: `pl-6 font-receipt text-base text-ink-muted` with dot leaders
- Split fraction: `(1/2)` etc in `text-ink-faded`
- Person blocks separated by `receipt-separator` dashed lines

**Step 2: Commit**

```bash
git add src/components/receipt/SplitSection.tsx
git commit -m "feat: receipt-styled split breakdown with circles"
```

---

### Task 12: ShareSection — Underlined monospace buttons

**Files:**
- Modify: `src/components/receipt/ShareSection.tsx` (lines 1-114)

**Step 1: Restyle share buttons**

Replace rounded zinc buttons with underlined receipt text:

```tsx
<button className="font-receipt text-base text-ink-muted underline decoration-ink-faded underline-offset-2 transition-colors hover:text-ink">
  copy link
</button>
```

- Button group: `flex flex-wrap items-center justify-center gap-x-4 gap-y-2`
- "copied!" feedback: `font-receipt text-base text-ink font-bold` (no underline)
- Remove all `bg-zinc-800`, `rounded-lg`, `hover:bg-zinc-700`

**Step 2: Commit**

```bash
git add src/components/receipt/ShareSection.tsx
git commit -m "feat: underlined receipt-text share buttons"
```

---

### Task 13: ScanSection + Scan Components — Receipt-themed scan UI

**Files:**
- Modify: `src/components/receipt/ScanSection.tsx` (lines 1-116)
- Modify: `src/components/scan/ImageCapture.tsx` (lines 1-44)
- Modify: `src/components/scan/OcrProgress.tsx` (lines 1-14)
- Modify: `src/components/scan/ImagePreview.tsx` (lines 1-26)

**Step 1: Restyle ScanSection**

- Success text: `font-receipt text-base text-ink` with checkmark
- Error text: `font-receipt text-base text-accent`
- Gallery/manual buttons: `font-receipt text-base text-ink-muted underline` (was bordered zinc)

**Step 2: Restyle ImageCapture**

- Dashed button: `w-full border-2 border-dashed border-ink-faded px-6 py-8 text-center transition-colors hover:border-ink`
- Button text: `font-receipt text-xl text-ink` with `[ SCAN RECEIPT ]`
- Subtext: `font-receipt text-base text-ink-muted`

**Step 3: Restyle OcrProgress**

- Status text: `font-receipt text-xl text-ink animate-pulse` with `[ SCANNING... ]`
- Subtext: `font-receipt text-base text-ink-muted`

**Step 4: Restyle ImagePreview**

- Image: `max-h-48 border border-ink-faded object-contain opacity-60` (faded receipt printout look)
- Retake link: `font-receipt text-base text-ink-muted underline`

**Step 5: Commit**

```bash
git add src/components/receipt/ScanSection.tsx src/components/scan/ImageCapture.tsx src/components/scan/OcrProgress.tsx src/components/scan/ImagePreview.tsx
git commit -m "feat: receipt-themed scan UI"
```

---

### Task 14: Landing Page — Receipt-styled homepage

**Files:**
- Modify: `src/app/page.tsx` (lines 1-82)

**Step 1: Restyle landing page**

- Title: `font-receipt text-5xl uppercase tracking-[0.15em] text-ink text-center` (was zinc-100 with negative margin hack — remove the -mr- fix since VT323 handles spacing differently)
- Error text: `font-receipt text-base text-accent`
- Loading text: `font-receipt text-base text-ink-muted`
- Separator: `receipt-separator text-sm` with `================================`
- Remove all zinc color references

**Step 2: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: receipt-styled landing page"
```

---

### Task 15: RecentSection — Receipt line items with swipe

**Files:**
- Modify: `src/components/receipt/RecentSection.tsx` (lines 1-49)

**Step 1: Restyle recent receipts**

- Section header: `font-receipt text-base uppercase text-ink-muted`
- Receipt link: `flex min-w-0 flex-1 items-baseline justify-between py-1.5 font-receipt text-lg text-ink transition-colors hover:text-ink-muted`
  - Name: `truncate text-ink`
  - Time: `text-base text-ink-faded`
  - Dot leaders between name and time
- Remove button: `font-receipt text-base text-ink-faded hover:text-accent` (was zinc-600 with opacity transition)

**Step 2: Commit**

```bash
git add src/components/receipt/RecentSection.tsx
git commit -m "feat: receipt-styled recent receipts"
```

---

### Task 16: Receipt Page — Update container and wrapper styles

**Files:**
- Modify: `src/app/receipt/[id]/page.tsx` (lines 1-153)

**Step 1: Restyle receipt page**

- Back button: `inline-flex items-center gap-1 font-receipt text-base text-ink-muted underline` (was rounded pill with amber on zinc-800)
- Unassigned warning: `font-receipt text-base text-accent` (was amber)
- Remove all `bg-zinc-*`, `text-zinc-*`, `text-amber-*` references

**Step 2: Commit**

```bash
git add src/app/receipt/[id]/page.tsx
git commit -m "feat: receipt-styled page wrapper"
```

---

### Task 17: UI Primitives — Button, Input, CurrencyInput

**Files:**
- Modify: `src/components/ui/Button.tsx` (lines 1-48)
- Modify: `src/components/ui/Input.tsx` (lines 1-29)
- Modify: `src/components/ui/CurrencyInput.tsx` (lines 1-60)

**Step 1: Restyle Button**

Update variants to receipt palette:
- `primary`: `font-receipt text-lg bg-ink text-paper hover:bg-ink/80` (dark ink button on cream)
- `secondary`: `font-receipt text-lg text-ink-muted underline hover:text-ink` (underlined text)
- `danger`: `font-receipt text-lg text-accent underline hover:text-accent/80`
- `ghost`: `font-receipt text-lg text-ink-muted hover:text-ink`
- Base: remove `rounded-lg`, use `rounded-sm` or no rounding. Remove focus ring amber — use `focus-visible:outline-ink`.

**Step 2: Restyle Input**

- Label: `font-receipt text-sm uppercase tracking-wider text-ink-muted`
- Input: `border-b-2 border-ink-faded bg-transparent font-receipt text-lg text-ink placeholder:text-ink-faded focus:border-ink focus:outline-none`
- Remove all `rounded-lg`, `border-zinc-*`, `bg-zinc-*` classes

**Step 3: Restyle CurrencyInput**

No visual changes needed since it inherits className from parent. Just ensure the default behavior works with the new underlined input style (the parent passes the className).

**Step 4: Commit**

```bash
git add src/components/ui/Button.tsx src/components/ui/Input.tsx src/components/ui/CurrencyInput.tsx
git commit -m "feat: receipt-styled UI primitives"
```

---

### Task 18: PrintItemsList — Match new receipt styling

**Files:**
- Modify: `src/components/receipt/PrintItemsList.tsx` (lines 1-42)

**Step 1: Update print item list**

- Use `font-receipt` class
- Use `text-ink` colors
- Dot leaders between item name and price
- `===` separator character

This component only renders in print — keep `.print-only` class.

**Step 2: Commit**

```bash
git add src/components/receipt/PrintItemsList.tsx
git commit -m "feat: receipt-styled print items list"
```

---

### Task 19: Final Integration — Visual QA and cleanup

**Files:**
- Possibly any file with leftover zinc/amber references

**Step 1: Search for leftover old-theme references**

Run: `grep -rn "zinc\|amber" src/` and fix any remaining references.

Also check: `grep -rn "bg-zinc\|text-zinc\|border-zinc\|text-amber\|bg-amber\|border-amber" src/`

**Step 2: Run the dev server and manually test all pages**

Run: `npm run dev`

Test checklist:
- [ ] Landing page: cream receipt, scan button, recent receipts
- [ ] Receipt page: header, people, items, tax/tip, totals, split, share
- [ ] Swipe-to-delete: strikethrough appears, item collapses
- [ ] People: add, edit, delete, select for assignment
- [ ] Item tap: expand, edit name/qty/price, assign people
- [ ] Tax/tip: tap to expand, presets, custom input
- [ ] Print: `Cmd+P` shows clean light receipt
- [ ] Share buttons: copy link, share, copy split, pdf, csv

**Step 3: Run tests**

Run: `npm test`
Expected: All 39 tests pass.

**Step 4: Run build**

Run: `npm run build`
Expected: Clean build with no errors.

**Step 5: Commit any remaining fixes**

```bash
git add -A
git commit -m "chore: clean up remaining old-theme references"
```

---

### Task 20: Final build verification

**Step 1: Run full test suite and production build**

Run: `npm test && npm run build`
Expected: All tests pass, build succeeds with no warnings.

**Step 2: Commit if any final adjustments were needed**

Only commit if there are changes from the build step (e.g., generated files).
