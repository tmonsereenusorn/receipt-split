"use client";

import { clsx } from "clsx";

interface PersonChipProps {
  name: string;
  color: string;
  assigned: boolean;
  onToggle: () => void;
}

export function PersonChip({
  name,
  color,
  assigned,
  onToggle,
}: PersonChipProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={clsx(
        "rounded-full px-3 py-1 text-xs font-medium transition-all",
        assigned
          ? "text-white shadow-sm"
          : "border bg-white hover:opacity-80"
      )}
      style={
        assigned
          ? { backgroundColor: color }
          : { borderColor: color, color: color }
      }
      aria-pressed={assigned}
      aria-label={`${assigned ? "Unassign" : "Assign"} ${name}`}
    >
      {name}
    </button>
  );
}
