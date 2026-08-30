"use client";

import { useState } from "react";
import { countAssignedItems } from "@/lib/people";
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
  // Holds WHICH person is being confirmed, not a boolean. Switching selection
  // then invalidates it by comparison, so a pending "really?" can never be
  // answered for a different person — no effect and no remount needed.
  const [confirmingFor, setConfirmingFor] = useState<string | null>(null);
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
  const confirmingRemove =
    activePeople !== undefined && confirmingFor === activePeople.id;
  const assignedCount = activePeople
    ? countAssignedItems(items, activePeople.id)
    : 0;

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
                  className="flex items-center gap-1"
                >
                  <input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-20 border-b-2 border-ink-faded bg-transparent font-hand text-lg text-ink focus:border-ink focus:outline-none px-1"
                    autoFocus
                    onBlur={() => {
                      setTimeout(saveEdit, 150);
                    }}
                  />
                  <button
                    type="submit"
                    disabled={!editName.trim()}
                    className={`font-receipt text-lg transition-colors ${editName.trim() ? 'text-ink hover:text-ink-muted' : 'text-ink-faded'}`}
                    aria-label="Save name"
                  >
                    ✓
                  </button>
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
          <form onSubmit={handleAdd} className="flex items-center gap-1">
            <input
              value={newName.trim()}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="name"
              className="w-20 border-b-2 border-ink-faded bg-transparent font-hand text-lg text-ink placeholder:text-ink-faded focus:border-ink focus:outline-none px-1"
              autoFocus
              onBlur={() => {
                // Small delay so the checkmark click registers before blur
                setTimeout(() => {
                  if (!newName.trim()) setNewName("");
                }, 150);
              }}
            />
            <button
              type="submit"
              disabled={!newName.trim()}
              className={`font-receipt text-lg transition-colors ${newName.trim() ? 'text-ink hover:text-ink-muted' : 'text-ink-faded'}`}
              aria-label="Confirm name"
            >
              ✓
            </button>
          </form>
        ) : null}
      </div>
      {activePeople && (
        <div className="mt-2 text-center">
          <p className="font-hand text-lg" style={{ color: activePeople.color }}>
            tap items to assign to {activePeople.name}
          </p>

          {/* Per-person actions live here rather than on the pill: this line
              already responds to selection, sits outside the tap-to-assign
              path, and gives text-sized targets instead of glyphs pinned to a
              40px circle — which on touch were invisible but still tappable. */}
          <div className="no-print mt-1 flex items-center justify-center gap-1 font-receipt text-base">
            {confirmingRemove ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    onDelete(activePeople.id);
                    setConfirmingFor(null);
                  }}
                  className="px-3 py-2 text-accent underline"
                >
                  {assignedCount > 0
                    ? `really? removes ${activePeople.name} from ${assignedCount} item${
                        assignedCount === 1 ? "" : "s"
                      }`
                    : "really?"}
                </button>
                <span className="text-ink-faded" aria-hidden="true">
                  ·
                </span>
                <button
                  type="button"
                  onClick={() => setConfirmingFor(null)}
                  className="px-3 py-2 text-ink-muted underline transition-colors hover:text-ink"
                >
                  cancel
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => startEdit(activePeople)}
                  className="px-3 py-2 text-ink-muted underline transition-colors hover:text-ink"
                >
                  rename
                </button>
                <span className="text-ink-faded" aria-hidden="true">
                  ·
                </span>
                <button
                  type="button"
                  onClick={() => setConfirmingFor(activePeople.id)}
                  className="px-3 py-2 text-ink-muted underline transition-colors hover:text-accent"
                >
                  remove
                </button>
              </>
            )}
          </div>
        </div>
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
