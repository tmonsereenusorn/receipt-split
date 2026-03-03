"use client";

import { useState } from "react";
import { ReceiptItem, Person } from "@/types";
import { Section } from "./Section";
import { ItemRow } from "./ItemRow";

interface ItemsSectionProps {
  items: ReceiptItem[];
  people: Person[];
  activePerson: string | null;
  onUpdate: (id: string, updates: Partial<Omit<ReceiptItem, "id">>) => void;
  onDelete: (id: string) => void;
  onToggleAssignment: (itemId: string, personId: string) => void;
  onAddItem: () => void;
}

export function ItemsSection({
  items,
  people,
  activePerson,
  onUpdate,
  onDelete,
  onToggleAssignment,
  onAddItem,
}: ItemsSectionProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <Section>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="font-receipt text-base uppercase text-ink-muted">
          Items{" "}
          <span className="font-receipt text-base text-ink-faded">({items.length})</span>
        </h3>
        <button
          type="button"
          onClick={onAddItem}
          className="font-receipt text-base text-ink-muted underline hover:text-ink"
        >
          + add
        </button>
      </div>

      {items.length === 0 ? (
        <p className="py-6 text-center font-receipt text-base text-ink-faded">
          no items yet
        </p>
      ) : (
        <div>
          {items.map((item) => (
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
          ))}
        </div>
      )}
    </Section>
  );
}
