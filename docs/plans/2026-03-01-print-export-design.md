# Print/PDF Export Redesign

## Context

The PDF export (via window.print / Save as PDF) currently breaks the receipt tape design — sections get cut at arbitrary points across page boundaries, the dark theme is stripped without a coherent replacement, and interactive editing elements appear in the output.

## Design Decisions

### Approach: Print CSS Overhaul

Use `@media print` styles to transform the receipt tape into a clean, light, receipt-style PDF. No new dependencies.

### Two-Page PDF Structure

**Page 1 — Split Summary:**
- Receipt header (title, date/time, decorative separator)
- Totals section (SUBTOTAL, TAX, TIP, TOTAL)
- Per-person split breakdowns (name, items, tax/tip share, total per person)

**Page 2 — Original Receipt Items:**
- Section header: "ITEMS"
- Full item list: `qty × name ... $price`
- Subtotal at bottom
- Forced to new page via `break-before: page`

### What to Hide in Print

- Scan section
- People section (assignment visible in split already)
- Interactive items section (replaced by print-only items section)
- Tax/Tip editing section
- Share actions (already has `no-print`)
- Unassigned warning
- Torn paper edges

### Print Color Scheme

| Role | Value |
|------|-------|
| Background | white |
| Text | `#171717` |
| Muted/labels | `#6b7280` |
| Separators | `#d1d5db` dashed |
| Person dots | Keep actual person colors |

### Layout

- Keep narrow centered column (`max-width: 28rem`) — receipt look
- Generous horizontal padding (`2rem`)
- Tighter vertical spacing (section padding ~`0.75rem`)
- Font size: `11pt` base
- Monospace numbers preserved

### Page Break Rules

- `break-inside: avoid` on each person's split block
- `break-inside: avoid` on totals section
- `break-after: avoid` on receipt header
- Page breaks allowed between people if list is long
- `break-before: page` on the items page

### Print-Only Items Section

A new component rendered only in `@media print` (hidden on screen) that shows the full item list in receipt-line format. This avoids showing the interactive expandable items in print while still providing the item detail on a dedicated page.
