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

  const activePeople = people.find((p) => p.id === activePerson);

  return (
    <Section>
      <h3 className="mb-3 font-receipt text-base uppercase tracking-wider text-ink-muted">
        People
      </h3>
      <div className="flex flex-wrap items-center gap-3">
        {people.map((person) => {
          const isActive = activePerson === person.id;
          const initial = person.name.charAt(0).toUpperCase();
          const itemCount = items.filter((item) => item.assignedTo.includes(person.id)).length;

          return (
            <div key={person.id} className="group relative flex flex-col items-center">
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
                    className="w-24 border-b-2 border-ink-faded bg-transparent font-hand text-lg text-ink focus:border-ink focus:outline-none px-1"
                    autoFocus
                    onBlur={saveEdit}
                  />
                </form>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => onSelectPerson(isActive ? null : person.id)}
                    className="relative w-10 h-10 rounded-full flex items-center justify-center font-hand text-lg font-bold cursor-pointer transition-all"
                    style={
                      isActive
                        ? {
                            backgroundColor: person.color,
                            color: '#faf5e8',
                            boxShadow: `0 0 0 3px ${person.color}40`,
                            transform: 'scale(1.1)',
                          }
                        : {
                            backgroundColor: 'transparent',
                            color: person.color,
                            border: `2px solid ${person.color}`,
                          }
                    }
                    aria-pressed={isActive}
                    aria-label={`Select ${person.name}`}
                  >
                    {initial}
                    {items.length > 0 && itemCount > 0 && (
                      <span className="absolute -bottom-1 -right-1 font-receipt text-[10px] bg-paper text-ink-muted rounded-full px-1">
                        {itemCount}
                      </span>
                    )}
                  </button>
                  <div className="absolute -top-1 -right-2 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); startEdit(person); }}
                      className="text-ink-faded hover:text-ink text-xs transition-colors"
                      aria-label={`Edit ${person.name}`}
                    >
                      ✎
                    </button>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); onDelete(person.id); }}
                      className="text-ink-faded hover:text-accent text-xs transition-colors"
                      aria-label={`Remove ${person.name}`}
                    >
                      ×
                    </button>
                  </div>
                </>
              )}
            </div>
          );
        })}
        {newName === "" && !editingId ? (
          <button
            type="button"
            onClick={() => setNewName(" ")}
            className="w-10 h-10 rounded-full border-2 border-dashed border-ink-faded flex items-center justify-center font-receipt text-lg text-ink-faded hover:border-ink-muted hover:text-ink-muted cursor-pointer transition-colors"
            aria-label="Add person"
          >
            +
          </button>
        ) : !editingId ? (
          <form onSubmit={handleAdd} className="flex items-center">
            <input
              value={newName.trim()}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="name"
              className="w-24 border-b-2 border-ink-faded bg-transparent font-hand text-lg text-ink placeholder:text-ink-faded focus:border-ink focus:outline-none px-1"
              autoFocus
              onBlur={() => {
                if (!newName.trim()) setNewName("");
              }}
            />
          </form>
        ) : null}
      </div>
      {activePeople && (
        <p
          className="mt-2 text-center font-hand text-lg"
          style={{ color: activePeople.color }}
        >
          tap items to assign to {activePeople.name}
        </p>
      )}
      {people.length > 0 && items.length > 0 && !activePerson &&
        items.some((item) => item.assignedTo.length === 0) && (
        <p className="mt-2 text-center font-hand text-lg text-ink-muted">
          tap a person to start assigning items
        </p>
      )}
    </Section>
  );
}
