"use client";

import { useState } from "react";
import { Person, ReceiptItem } from "@/types";

interface PeopleBarProps {
  people: Person[];
  items: ReceiptItem[];
  activePerson: string | null;
  onSelectPerson: (id: string | null) => void;
  onAdd: (name: string) => void;
  onUpdate: (id: string, name: string) => void;
  onDelete: (id: string) => void;
}

export function PeopleBar({ people, items, activePerson, onSelectPerson, onAdd, onUpdate, onDelete }: PeopleBarProps) {
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
  const showAddInput = newName !== "" && !editingId;

  return (
    <div className="no-print sticky top-0 z-20">
      {/* Bar background — matches receipt paper */}
      <div className="bg-paper px-4 pb-2 pt-3 shadow-sm shadow-black/10">
        <div className="font-receipt text-base uppercase text-ink-muted mb-2">People</div>
        <div className="flex items-center gap-2">
          {/* People circles */}
          <div className="flex flex-1 flex-wrap items-center gap-3 py-1">
            {people.map((person) => {
              const isActive = activePerson === person.id;
              const initial = person.name.charAt(0).toUpperCase();
              const itemCount = items.filter((item) => item.assignedTo.includes(person.id)).length;

              if (editingId === person.id) {
                return (
                  <form
                    key={person.id}
                    onSubmit={(e) => { e.preventDefault(); saveEdit(); }}
                    className="flex shrink-0 items-center gap-1"
                  >
                    <input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="w-20 border-b-2 border-ink-faded bg-transparent px-1 font-hand text-lg text-ink focus:border-ink focus:outline-none"
                      autoFocus
                      onBlur={() => { setTimeout(saveEdit, 150); }}
                    />
                    <button
                      type="submit"
                      disabled={!editName.trim()}
                      className={`font-receipt text-lg transition-colors ${editName.trim() ? "text-ink hover:text-ink-muted" : "text-ink-faded"}`}
                      aria-label="Save name"
                    >
                      ✓
                    </button>
                  </form>
                );
              }

              return (
                <div key={person.id} className="group relative shrink-0">
                  <button
                    type="button"
                    onClick={() => onSelectPerson(isActive ? null : person.id)}
                    className="relative flex h-9 w-9 items-center justify-center rounded-full font-hand text-base font-bold transition-all"
                    style={
                      isActive
                        ? {
                            backgroundColor: person.color,
                            color: "#faf5e8",
                            boxShadow: `0 0 0 3px ${person.color}40`,
                            transform: "scale(1.1)",
                          }
                        : {
                            backgroundColor: "transparent",
                            color: person.color,
                            border: `2px solid ${person.color}`,
                          }
                    }
                    aria-pressed={isActive}
                    aria-label={`Select ${person.name}`}
                  >
                    {initial}
                    {items.length > 0 && itemCount > 0 && (
                      <span className="absolute -bottom-1 -right-1 rounded-full bg-paper px-1 font-receipt text-[10px] text-ink-muted">
                        {itemCount}
                      </span>
                    )}
                  </button>
                  {/* Edit/delete on hover */}
                  <div className="absolute -right-1 -top-1 flex gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); startEdit(person); }}
                      className="text-xs text-ink-faded transition-colors hover:text-ink"
                      aria-label={`Edit ${person.name}`}
                    >
                      ✎
                    </button>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); onDelete(person.id); }}
                      className="text-xs text-ink-faded transition-colors hover:text-accent"
                      aria-label={`Remove ${person.name}`}
                    >
                      ×
                    </button>
                  </div>
                </div>
              );
            })}

            {/* Add person */}
            {!showAddInput && !editingId && (
              <button
                type="button"
                onClick={() => setNewName(" ")}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-dashed border-ink-faded font-receipt text-base text-ink-faded transition-colors hover:border-ink-muted hover:text-ink-muted"
                aria-label="Add person"
              >
                +
              </button>
            )}
            {showAddInput && (
              <form onSubmit={handleAdd} className="flex shrink-0 items-center gap-1">
                <input
                  value={newName.trim()}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="name"
                  className="w-20 border-b-2 border-ink-faded bg-transparent px-1 font-hand text-lg text-ink placeholder:text-ink-faded focus:border-ink focus:outline-none"
                  autoFocus
                  onBlur={() => {
                    setTimeout(() => {
                      if (!newName.trim()) setNewName("");
                    }, 150);
                  }}
                />
                <button
                  type="submit"
                  disabled={!newName.trim()}
                  className={`font-receipt text-lg transition-colors ${newName.trim() ? "text-ink hover:text-ink-muted" : "text-ink-faded"}`}
                  aria-label="Confirm name"
                >
                  ✓
                </button>
              </form>
            )}
          </div>
        </div>

        {/* Active person hint */}
        {activePeople && (
          <p
            className="mt-1 text-center font-hand text-base"
            style={{ color: activePeople.color }}
          >
            tap items to assign to {activePeople.name}
          </p>
        )}
        {people.length > 0 && items.length > 0 && !activePerson &&
          items.some((item) => item.assignedTo.length === 0) && (
          <p className="mt-1 text-center font-hand text-base text-ink-muted">
            tap a person to start assigning items
          </p>
        )}
      </div>
    </div>
  );
}
