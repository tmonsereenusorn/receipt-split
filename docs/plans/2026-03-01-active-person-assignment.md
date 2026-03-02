# Active Person Assignment Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add an "active person" selection mode so users can tap their name then tap items to claim them, replacing the expand-then-assign workflow.

**Architecture:** New `activePerson` state in the receipt page, passed to PeopleSection (for selection) and ItemsSection/ItemRow (for tap-to-assign behavior and visual feedback). PeopleSection gets new select/deselect interaction (single tap selects, edit via icon). ItemRow switches between expand mode (no active person) and assign mode (active person set).

**Tech Stack:** React state, Tailwind CSS

---

### Task 1: Add `activePerson` state and thread it through props

**Files:**
- Modify: `src/app/receipt/[id]/page.tsx`
- Modify: `src/components/receipt/PeopleSection.tsx`
- Modify: `src/components/receipt/ItemsSection.tsx`
- Modify: `src/components/receipt/ItemRow.tsx`

**Step 1: Add state to the receipt page**

In `src/app/receipt/[id]/page.tsx`:

1. Add `useState` to the React import (line 3):
```ts
import { use, useEffect, useState } from "react";
```

2. Add state inside the component, after `const { upsert: upsertRecent } = useRecentReceipts();` (line 26):
```ts
const [activePerson, setActivePerson] = useState<string | null>(null);
```

3. Pass new props to PeopleSection (lines 92-98). Replace the existing `<PeopleSection ... />` with:
```tsx
<PeopleSection
  people={receipt.people}
  items={receipt.items}
  activePerson={activePerson}
  onSelectPerson={setActivePerson}
  onAdd={receipt.addPerson}
  onUpdate={receipt.updatePerson}
  onDelete={receipt.deletePerson}
/>
```

4. Pass `activePerson` to ItemsSection (lines 103-110). Replace the existing `<ItemsSection ... />` with:
```tsx
<ItemsSection
  items={receipt.items}
  people={receipt.people}
  activePerson={activePerson}
  onUpdate={receipt.updateItem}
  onDelete={receipt.deleteItem}
  onToggleAssignment={receipt.toggleAssignment}
  onAddItem={() => receipt.addItem("New Item", 1, 0)}
/>
```

**Step 2: Update PeopleSection interface**

In `src/components/receipt/PeopleSection.tsx`, update the interface (lines 7-13):
```ts
interface PeopleSectionProps {
  people: Person[];
  items: ReceiptItem[];
  activePerson: string | null;
  onSelectPerson: (id: string | null) => void;
  onAdd: (name: string) => void;
  onUpdate: (id: string, name: string) => void;
  onDelete: (id: string) => void;
}
```

Update the destructuring (line 15):
```ts
export function PeopleSection({ people, items, activePerson, onSelectPerson, onAdd, onUpdate, onDelete }: PeopleSectionProps) {
```

(Don't change behavior yet — just thread the props. The component still works as before.)

**Step 3: Update ItemsSection interface**

In `src/components/receipt/ItemsSection.tsx`, update the interface (lines 8-15):
```ts
interface ItemsSectionProps {
  items: ReceiptItem[];
  people: Person[];
  activePerson: string | null;
  onUpdate: (id: string, updates: Partial<Omit<ReceiptItem, "id">>) => void;
  onDelete: (id: string) => void;
  onToggleAssignment: (itemId: string, personId: string) => void;
  onAddItem: () => void;
}
```

Update destructuring (line 17):
```ts
export function ItemsSection({
  items,
  people,
  activePerson,
  onUpdate,
  onDelete,
  onToggleAssignment,
  onAddItem,
}: ItemsSectionProps) {
```

Pass `activePerson` to each ItemRow (line 49-60). Replace the existing `<ItemRow ... />` with:
```tsx
<ItemRow
  key={item.id}
  item={item}
  people={people}
  activePerson={activePerson}
  isExpanded={expandedId === item.id}
  onToggleExpand={() =>
    setExpandedId(expandedId === item.id ? null : item.id)
  }
  onUpdate={onUpdate}
  onDelete={onDelete}
  onToggleAssignment={onToggleAssignment}
/>
```

**Step 4: Update ItemRow interface**

In `src/components/receipt/ItemRow.tsx`, update the interface (lines 8-16):
```ts
interface ItemRowProps {
  item: ReceiptItem;
  people: Person[];
  activePerson: string | null;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onUpdate: (id: string, updates: Partial<Omit<ReceiptItem, "id">>) => void;
  onDelete: (id: string) => void;
  onToggleAssignment: (itemId: string, personId: string) => void;
}
```

Add `activePerson` to destructuring (line 18-26):
```ts
export function ItemRow({
  item,
  people,
  activePerson,
  isExpanded,
  onToggleExpand,
  onUpdate,
  onDelete,
  onToggleAssignment,
}: ItemRowProps) {
```

(Don't change behavior yet.)

**Step 5: Verify build**

Run: `npm run build`
Expected: Compiled successfully.

**Step 6: Commit**

```bash
git add src/app/receipt/\\[id\\]/page.tsx src/components/receipt/PeopleSection.tsx src/components/receipt/ItemsSection.tsx src/components/receipt/ItemRow.tsx
git commit -m "refactor: thread activePerson state through component tree"
```

---

### Task 2: PeopleSection — select/deselect + edit via icon

**Files:**
- Modify: `src/components/receipt/PeopleSection.tsx`

**Step 1: Change person chip tap behavior**

Replace the person chip button and surrounding markup. The current chip button (lines 65-81) calls `startEdit` on click. Change it so:
- Single tap calls `onSelectPerson` (select/deselect toggle)
- A small pencil/edit button appears on hover for editing
- Active person gets a prominent filled style

Replace the entire `<>...</>` fragment for the non-editing state (lines 63-91) with:

```tsx
<>
  <button
    type="button"
    onClick={() => onSelectPerson(activePerson === person.id ? null : person.id)}
    className="flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-all"
    style={
      activePerson === person.id
        ? { backgroundColor: person.color, color: "#18181b", border: `1px solid ${person.color}` }
        : { backgroundColor: `${person.color}20`, color: person.color, border: `1px solid ${person.color}40` }
    }
    aria-pressed={activePerson === person.id}
  >
    <span
      className="inline-block h-2 w-2 rounded-full"
      style={{ backgroundColor: activePerson === person.id ? "#18181b" : person.color }}
    />
    {person.name}
    {items.length > 0 && (
      <span className="ml-0.5 opacity-60">
        {items.filter((item) => item.assignedTo.includes(person.id)).length}
      </span>
    )}
  </button>
  <button
    type="button"
    onClick={() => startEdit(person)}
    className="-ml-1 opacity-0 transition-opacity group-hover:opacity-100 text-xs"
    style={{ color: person.color }}
    aria-label={`Edit ${person.name}`}
  >
    ✎
  </button>
  <button
    type="button"
    onClick={() => onDelete(person.id)}
    className="-ml-1 opacity-0 transition-opacity group-hover:opacity-100 hover:opacity-70 text-xs"
    style={{ color: person.color }}
    aria-label={`Remove ${person.name}`}
  >
    ×
  </button>
</>
```

**Step 2: Add hint text**

After the closing `</div>` of the flex-wrap container (after line 103 in the current file), add the hint text. Place it before the closing `</Section>`:

```tsx
{people.length > 0 && items.length > 0 && !activePerson && (
  <p className="mt-2 text-center font-mono text-xs text-zinc-600">
    tap your name to claim items
  </p>
)}
```

**Step 3: Verify build**

Run: `npm run build`
Expected: Compiled successfully.

**Step 4: Commit**

```bash
git add src/components/receipt/PeopleSection.tsx
git commit -m "feat: add person select/deselect with hint text"
```

---

### Task 3: ItemRow — tap-to-assign mode + visual feedback

**Files:**
- Modify: `src/components/receipt/ItemRow.tsx`

**Step 1: Change row click behavior and left border**

In ItemRow, the collapsed row button (line 58-93) currently always calls `onToggleExpand`. Change it so when `activePerson` is set, it toggles assignment instead.

Replace the outer `<div>` className (line 54-55). The left border should reflect the active person's assignment state when someone is active, or fall back to the current amber-for-unassigned behavior:

```tsx
<div
  className="transition-colors border-l-2"
  style={{
    borderLeftColor: activePerson
      ? item.assignedTo.includes(activePerson)
        ? (people.find((p) => p.id === activePerson)?.color ?? "transparent")
        : "transparent"
      : isUnassigned
        ? "rgba(245, 158, 11, 0.6)"
        : "transparent",
  }}
>
```

Replace the collapsed row `<button>` onClick (line 60):

```tsx
onClick={() => {
  if (activePerson) {
    onToggleAssignment(item.id, activePerson);
  } else {
    onToggleExpand();
  }
}}
```

**Step 2: Verify build**

Run: `npm run build`
Expected: Compiled successfully.

**Step 3: Run all tests**

Run: `npm test`
Expected: All 44 tests pass.

**Step 4: Commit**

```bash
git add src/components/receipt/ItemRow.tsx
git commit -m "feat: tap-to-assign items when active person is selected"
```

---

### Task 4: Clear activePerson when person is deleted

**Files:**
- Modify: `src/app/receipt/[id]/page.tsx`

**Step 1: Wrap deletePerson to also clear activePerson**

In the receipt page, the `onDelete` prop for PeopleSection currently passes `receipt.deletePerson` directly. We need to also clear `activePerson` if the deleted person was the active one.

Replace the `onDelete={receipt.deletePerson}` prop in PeopleSection (around line 98) with:

```tsx
onDelete={(id) => {
  if (activePerson === id) setActivePerson(null);
  receipt.deletePerson(id);
}}
```

**Step 2: Verify build**

Run: `npm run build && npm test`
Expected: Build succeeds. All 44 tests pass.

**Step 3: Commit**

```bash
git add src/app/receipt/\\[id\\]/page.tsx
git commit -m "fix: clear activePerson when the selected person is deleted"
```
