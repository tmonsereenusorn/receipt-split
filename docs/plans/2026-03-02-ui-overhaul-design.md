# UI Overhaul — Skeuomorphic Receipt Design

## Goal

Redesign the Shplit interface to look and feel like a real thermal receipt — warm cream paper, dot-matrix typography, pen-style annotations, and tactile interactions. All existing functionality preserved; zero behavior changes.

## Visual Foundation

### Paper & Background
- Page background: dark charcoal (`#1a1a1a`)
- Receipt paper: warm cream (`#faf5e8`) with CSS noise texture (repeating gradient, no image assets)
- Box shadow beneath receipt to create depth
- Torn edges top and bottom — zigzag perforated thermal paper style (refined `clipPath` polygon)
- Max width stays `md` (448px), centered

### Typography
- **VT323** (Google Font) — thermal receipt dot-matrix monospace for all receipt content (items, prices, headers, totals, separators)
- **Caveat** (Google Font) — handwritten style for person names, initials, assignment annotations
- Font size bumped up from current since VT323 reads smaller than system fonts
- All item text in dark ink color on cream paper

### Separators
- Section breaks: dashed character lines (`- - - - - - - -`) not CSS borders
- Major breaks: double-line (`================================`)
- Printed as actual text characters in VT323

## Components

### Receipt Header
```
SHPLIT
03/02/2026  11:42 AM
================================
```
- Restaurant name (editable) in VT323 bold uppercase
- Auto-generated timestamp below
- `===` separator

### People Section
```
================================
WHO'S SPLITTING?
(A) (B) (C)  [+ add]
================================
```
- Each person: colored circle with first initial in Caveat font
- Active (selected): solid colored fill, slightly larger, subtle glow/ring
- Inactive: lighter outline circle
- `[+ add]`: dashed circle with `+`
- Adding a person: inline underlined blank (fill-in-the-blank style)
- Edit: long-press/double-tap opens editable underlined field + small `x` to delete
- Hint text when person active: "tap items to assign to [Name]" in Caveat, person's color

### Item Rows (Collapsed)
```
CHICKEN KARAAGE............$9.50
   A  B
2x BURGER.................$25.98
   C
FRIES......................$4.50
   (tap to assign)
```
- Name left-aligned, price right-aligned
- Dot leaders (`....`) filling the gap between name and price
- Quantity prefix when > 1 (e.g., `2x`)
- Below each item: colored initials of assigned people (Caveat font, each in person's color)
- Unassigned items show faded "(tap to assign)" in muted text

### Item Rows (Expanded — tap to edit)
- Opens inline below the row
- Name, qty, price inputs: underlined fields (no box borders — writing on receipt line)
- Person assignment: row of colored initial circles, tap to toggle
- "all / none" toggle as small receipt text

### Swipe-to-Delete
1. Swipe left — row translates with finger
2. At ~40% row width: red wavy SVG strikethrough line animates across text (pen-drawn, slightly imperfect path)
3. Text color fades to muted gray simultaneously
4. Release past threshold: item stays struck through 300ms, then collapses (height animation) and is removed
5. Release before threshold: row snaps back, strikethrough disappears
6. No separate red delete button — the strikethrough IS the delete affordance

### Tax & Tip
```
- - - - - - - - - - - - - -
TAX           8%       $2.84
TIP          20%       $7.10
- - - - - - - - - - - - - -
```
- Compact single-line showing current % and $ amount
- Tap row to expand: preset buttons (`5% 7% 8% 10%` for tax, `15% 18% 20% 25%` for tip)
- Presets: small receipt-text buttons, active one bold/underlined
- Custom input: underlined blank
- Toggle `%` / `$` mode

### Totals
```
================================
SUBTOTAL                 $35.48
TAX                       $2.84
TIP                       $7.10
================================
TOTAL                    $45.42
================================
```
- Double `===` lines above and below TOTAL
- TOTAL in slightly larger/bolder VT323
- Dot leaders between labels and amounts

### Split (visible when all items assigned)
```
- - - - - SPLIT - - - - -

(A) Alice                $22.71
  Chicken Karaage  1/2    $4.75
  2x Burger              $25.98
  tax                     $1.42
  tip                     $3.55

- - - - - - - - - - - - - -

(B) Bob                  $22.71
  ...
```
- Person's colored circle + name + total (right-aligned)
- Indented item breakdown in slightly smaller/muted text
- Split factor shown as fraction (1/2, 1/3) when shared
- Each person block separated by dashed line

### Share
```
- - - - - - - - - - - - - -
[copy link]  [share]  [copy split]
            [pdf]  [csv]
```
- Small monospace text buttons, underlined
- Tap feedback: brief "copied!" in-place
- Bottom of receipt, above torn edge

## Landing Page

```
~~~ torn edge ~~~

        SHPLIT
  03/02/2026  11:42 AM

================================

  ┌───────────────────┐
  │  [ SCAN RECEIPT ] │
  │   tap to capture  │
  └───────────────────┘

  [gallery]  [manual]

- - - - - - - - - - - -
RECENT RECEIPTS
Restaurant A       2h ago
Restaurant B       1d ago

~~~ torn edge ~~~
```
- Same cream receipt paper with torn edges
- Scan button: dashed border box, `[ SCAN RECEIPT ]` in VT323
- Gallery / manual entry as small underlined text links
- Recent receipts as swipeable line items (same pen strikethrough to remove)
- Scanning state: `[ SCANNING... ]` with pulse animation

## Color Palette

| Token | Value | Use |
|-------|-------|-----|
| `--page-bg` | `#1a1a1a` | Page background |
| `--paper` | `#faf5e8` | Receipt paper |
| `--ink` | `#2d2517` | Primary text (dark brown-black) |
| `--ink-muted` | `#8c7e6a` | Secondary text, hints |
| `--ink-faded` | `#c4b9a8` | Disabled/placeholder text |
| `--separator` | `#d4c9b8` | Dashed line separators |
| `--accent` | `#c0392b` | Strikethrough, unassigned warning |
| Person colors | Existing palette | Circle fills, initial text |

## Fonts

- VT323: `https://fonts.googleapis.com/css2?family=VT323&display=swap`
- Caveat: `https://fonts.googleapis.com/css2?family=Caveat:wght@400;700&display=swap`

## Non-Goals

- No behavior changes — all interactions work the same way
- No new features
- No data model changes
- No routing changes
