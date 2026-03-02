# Active Person Assignment UX — Design

## Problem

Assigning items to people requires expanding each item row and tapping person chips inside. This is 2+ taps per item and not discoverable — collaborators opening a shared link don't know what to do.

## Solution: "I am" mode

Add an `activePerson` selection to the People section. When a person is selected, tapping any item row toggles that person's assignment. When no one is selected, tapping an item row expands it (current behavior).

## State

- `activePerson: string | null` — lives in the receipt page, passed down as props
- Selecting a person chip sets `activePerson` to that person's ID
- Tapping the same chip again deselects (sets to `null`)
- Only one person active at a time

## PeopleSection changes

- New props: `activePerson`, `onSelectPerson`
- **Single tap** on a person chip → select/deselect (toggle `activePerson`)
- **Active chip styling:** fully opaque color background with dark text (like the assigned chip style in ItemRow), vs. current subtle tinted style for unselected
- **Edit mode:** changes from single tap to a small edit icon or long-press, since single tap is now select
- Item count badge remains on all chips

## ItemRow behavior

- **`activePerson` is set:** whole row tap toggles that person's assignment on/off
- **`activePerson` is null:** whole row tap expands/collapses (current behavior)
- Expand/collapse still works when `activePerson` is null

## Item row visual feedback

- When `activePerson` is set:
  - Rows where active person IS assigned → left border in that person's color
  - Rows where active person is NOT assigned → no left border
- When `activePerson` is null:
  - Current amber left border for unassigned items (existing behavior)

## Hint text

When people exist, items exist, but `activePerson` is null, show a subtle hint below People section: "tap your name to claim items". Disappears when someone is selected.

## Unchanged

- Expanding a row still shows edit fields (name, qty, price) and person assignment chips for multi-person splits
- The "all/none" toggle and per-person chips inside expanded rows still work
- Assigned dots on collapsed rows still show all assigned people
