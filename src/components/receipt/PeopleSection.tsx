"use client";

import { useState } from "react";
import { Person, ReceiptItem } from "@/types";
import { Section } from "./Section";

interface PeopleSectionProps {
  people: Person[];
  items: ReceiptItem[];
  activePerson: string | null;
  onSelectPerson: (id: string | null) => void;
  onAdd: (name: string) => void;
  onUpdate: (id: string, name: string) => void;
  onDelete: (id: string) => void;
}

export function PeopleSection({ people, items, activePerson, onSelectPerson, onAdd, onUpdate, onDelete }: PeopleSectionProps) {
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = newName.trim();
    if (!trimmed) return;
    onAdd(trimmed);
    setNewName("");
  }

  function startEdit(person: Person) {
    setEditingId(person.id);
    setEditName(person.name);
  }

  function saveEdit() {
    if (editingId && editName.trim()) {
      onUpdate(editingId, editName.trim());
    }
    setEditingId(null);
  }

  return (
    <Section>
      <h3 className="mb-3 text-xs font-medium uppercase tracking-wider text-zinc-500">
        People
      </h3>
      <div className="flex flex-wrap items-center gap-2">
        {people.map((person) => (
          <div key={person.id} className="group relative flex items-center">
            {editingId === person.id ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  saveEdit();
                }}
              >
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-20 rounded-full border border-zinc-600 bg-zinc-800 px-3 py-1 text-xs text-zinc-100 focus:border-amber-500 focus:outline-none"
                  autoFocus
                  onBlur={saveEdit}
                />
              </form>
            ) : (
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
                  className="-ml-1 opacity-40 transition-opacity group-hover:opacity-100 text-xs"
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
            )}
          </div>
        ))}
        <form onSubmit={handleAdd} className="flex items-center">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="+ add"
            className="w-20 rounded-full border border-dashed border-zinc-700 bg-transparent px-3 py-1 text-xs text-zinc-400 placeholder:text-zinc-600 focus:border-amber-500 focus:outline-none"
          />
        </form>
      </div>
      {people.length > 0 && items.length > 0 && !activePerson &&
        items.some((item) => item.assignedTo.length === 0) && (
        <p className="mt-2 text-center font-mono text-xs text-zinc-600">
          tap your name to claim items
        </p>
      )}
    </Section>
  );
}
