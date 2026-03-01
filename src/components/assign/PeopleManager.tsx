"use client";

import { useState } from "react";
import { Person } from "@/types";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";

interface PeopleManagerProps {
  people: Person[];
  onAdd: (name: string) => void;
  onUpdate: (id: string, name: string) => void;
  onDelete: (id: string) => void;
}

export function PeopleManager({
  people,
  onAdd,
  onUpdate,
  onDelete,
}: PeopleManagerProps) {
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
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-gray-700">People</h3>
      <div className="flex flex-wrap gap-2">
        {people.map((person) => (
          <div key={person.id} className="flex items-center gap-1">
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
                  className="w-20 rounded border px-1.5 py-0.5 text-xs"
                  autoFocus
                  onBlur={saveEdit}
                />
              </form>
            ) : (
              <Badge color={person.color}>
                <span
                  onClick={() => startEdit(person)}
                  className="cursor-pointer"
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") startEdit(person);
                  }}
                >
                  {person.name}
                </span>
                <button
                  type="button"
                  onClick={() => onDelete(person.id)}
                  className="ml-1.5 hover:opacity-70"
                  aria-label={`Remove ${person.name}`}
                >
                  ×
                </button>
              </Badge>
            )}
          </div>
        ))}
      </div>
      <form onSubmit={handleAdd} className="flex gap-2">
        <Input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Add person..."
          className="flex-1"
        />
        <Button type="submit" size="sm" disabled={!newName.trim()}>
          Add
        </Button>
      </form>
    </div>
  );
}
