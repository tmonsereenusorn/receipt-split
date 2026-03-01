# Receipt Tape UI Redesign

## Context

Receipt Split is a client-side Next.js app for friends splitting a restaurant bill. The current UI is functional but generic — white cards, blue buttons, standard Tailwind defaults across 3 separate pages. This redesign gives it personality, reduces friction, and improves information density.

## Design Decisions

### Single-Page Flow

Replace the 3-page route structure (scan → assign → summary) with a single scrolling page. Sections expand progressively as the user completes each step. No routing, no page loads.

Flow: Header → Scan → Items → People → Assignment (inline) → Tax/Tip → Totals → Split → Share

### Receipt Tape Layout

A centered narrow column (~420px max) styled like a thermal receipt strip:
- Page background: `#09090b` (zinc-950)
- Tape background: `#18181b` (zinc-900)
- Torn/jagged edges at top and bottom via CSS clip-path
- Dotted separators (`#3f3f46`) between sections, like dashed lines on a receipt
- On mobile: full-width with small padding. On desktop: centered with dark margins.

### Dark Mode Only

Single theme. No light mode toggle.

### Color Palette

| Role | Value | Tailwind |
|------|-------|----------|
| Page bg | `#09090b` | zinc-950 |
| Tape bg | `#18181b` | zinc-900 |
| Separator | `#3f3f46` | zinc-700 |
| Primary accent | `#f59e0b` | amber-500 |
| Text primary | `#fafafa` | zinc-50 |
| Text secondary | `#a1a1aa` | zinc-400 |
| Text muted | `#71717a` | zinc-500 |
| Success | `#22c55e` | green-500 |
| Danger | `#ef4444` | red-500 |

Person colors (8): cyan-400, violet-400, rose-400, emerald-400, orange-400, sky-400, fuchsia-400, lime-400

### Typography

- Body/labels: Geist Sans, `text-sm`
- All numbers/prices/totals: **Geist Mono** — the CLI nod
- App title: Geist Mono, uppercase, letter-spaced
- Section headers: Geist Sans, uppercase, `text-xs`, `tracking-wider`, zinc-500

Principle: monospace for data, sans-serif for words.

## Component Designs

### Header
- "RECEIPT SPLIT" in Geist Mono, uppercase, tracked-wide, centered
- Decorative separator line (`================================`)
- Date/time stamp in mono, zinc-500

### Scan Section
- Camera button: amber dashed border, outlined style
- OCR progress: mono-styled block characters `[████████░░░░] 67%`
- Parsed items slide in like receipt lines printing

### Items
- Tight rows: `qty x name ........... $price`
- Dot leaders connecting name to price (CSS flexbox with dotted border)
- Inline editing: tap name/price → amber underline input, no box
- Add item: `+ add item` row in zinc-500
- Delete: red x on hover/focus
- No drag handles (simplification)

### People
- Row of colored circular chips/pills
- `+` circle at end to add
- Tap to edit inline, x to delete on hover/focus

### Assignment (Inline)
- Collapsed item: `2 x Pad Thai ........... $18.00` with small colored dots showing assigned people
- Expanded item (on tap): person chips appear below for toggling
- "all" / "none" as small text links
- Unassigned items: subtle amber left-border indicator

### Tax & Tip
- Compact row: `TAX ___% | TIP ___%`
- Tap to expand preset pills + custom input
- Show calculated dollar amounts in mono

### Totals (Bottom of Receipt)
```
SUBTOTAL                    $85.00
TAX (8.5%)                   $7.23
TIP (20%)                   $17.00
================================
TOTAL                      $109.23
```

### Per-Person Split
```
● Alice                     $36.41
  2 x Pad Thai         $18.00
  1 x Spring Rolls      $6.00 (1/2)
  tax                    $2.41
  tip                    $5.67
```

### Share Actions
- Row of icon buttons: Copy, Share, PDF, CSV
- "Start Over" as text link

## Interaction Model

### Progressive Disclosure
Sections expand as user completes each step. Smooth max-height + opacity transitions (~300ms).

### Key Interactions
- Tap item to expand/collapse assignment chips
- Tap outside or another item to collapse current
- Running totals update live during assignment
- Amber pulse on unassigned items (left-border glow)
- No modals or popups — everything inline

### Navigation Helpers
- Small floating dot indicator on right edge showing current section
- Tap dot to scroll to section
- "Back to top" micro-button when scrolled past items

### Animations (Subtle)
- Section expand: max-height + opacity, ~300ms ease-out
- Item slide-in: staggered translateY + opacity, ~150ms per item
- Number changes: brief amber flash
- No bounces, springs, or parallax

### State
- Keep localStorage persistence
- On reload, restore state, show sections up to where user left off
- "Start Over" clears and scrolls to top

## Architecture Changes

### Routing
- Remove `/assign` and `/summary` routes
- Single page at `/` with all sections
- Remove Next.js page files for assign and summary

### Component Structure
New component tree:
```
ReceiptTape (main container, tape styling)
├── ReceiptHeader
├── ScanSection
├── ItemsSection
│   └── ItemRow (expandable, with inline assignment)
├── PeopleSection
├── TaxTipSection
├── TotalsSection
├── SplitSection
│   └── PersonSplit
├── ShareSection
└── ProgressDots (floating)
```

### State Management
- Keep ReceiptContext + useReducer
- Add UI state for section visibility and item expansion
- Remove router-based navigation logic
