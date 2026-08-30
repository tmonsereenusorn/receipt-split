"use client";

import { useState } from "react";
import { Section } from "./Section";

/** Stable row id; only ever used as a React key and for local edits. */
export function makeRowId(index: number): string {
  return `row-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 6)}`;
}

/** Common tip percentages, matching the TIP row on the receipt page. */
const TIP_PRESETS = [15, 18, 20, 25];

/**
 * A name row. Carries its own id so React can keep DOM nodes attached to rows
 * across a removal — with an index key, deleting a row destroys the node for
 * the vacated last index and drops focus mid-edit.
 */
export interface NameRow {
  id: string;
  name: string;
}

interface SetupSectionProps {
  names: NameRow[];
  onChangeNames: (names: NameRow[]) => void;
  tipEnabled: boolean;
  onToggleTip: (enabled: boolean) => void;
  tipPercent: number;
  onChangeTipPercent: (percent: number) => void;
  onContinue: () => void;
  isBusy: boolean;
  scanError: string | null;
  onRetake: () => void;
}

/**
 * The percent field keeps local string state and commits on blur, per
 * docs/conventions/react-patterns.md.
 *
 * Parsing every keystroke and feeding the number back as the controlled value
 * makes a decimal impossible to type: <input type="number"> reports "" for an
 * in-progress "12.", so parseFloat("") || 0 rewrites the box to 0 and "12.5"
 * lands on 5 — on a field that scales everyone's total.
 */
function TipPercentField({
  percent,
  onChange,
}: {
  percent: number;
  onChange: (percent: number) => void;
}) {
  // Seeded once; the call site remounts this on an external percent change (see
  // the key prop) rather than syncing through a state-resetting effect.
  const [local, setLocal] = useState(String(percent));

  return (
    <div className="flex items-center gap-1">
      <input
        type="number"
        step="0.1"
        min="0"
        max="100"
        value={local}
        aria-label="Tip percentage"
        onChange={(e) => setLocal(e.target.value)}
        onBlur={() => {
          const parsed = Math.max(0, parseFloat(local) || 0);
          setLocal(String(parsed));
          onChange(parsed);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
        }}
        className="w-16 border-b-2 border-ink-faded bg-transparent px-1 py-1 font-receipt text-lg text-ink focus:border-ink focus:outline-none"
      />
      <span className="font-receipt text-sm text-ink-faded">%</span>
    </div>
  );
}

export function SetupSection({
  names,
  onChangeNames,
  tipEnabled,
  onToggleTip,
  tipPercent,
  onChangeTipPercent,
  onContinue,
  isBusy,
  scanError,
  onRetake,
}: SetupSectionProps) {
  function setName(id: string, value: string) {
    onChangeNames(names.map((row) => (row.id === id ? { ...row, name: value } : row)));
  }

  function removeName(id: string) {
    onChangeNames(names.filter((row) => row.id !== id));
  }

  // A scan that already failed cannot be continued past — otherwise the user
  // fills the form and Continue lands on an empty receipt.
  if (scanError) {
    return (
      <Section>
        <p className="font-receipt text-lg uppercase text-ink">Scan failed</p>
        <p className="mt-2 font-receipt text-base text-ink-muted">{scanError}</p>
        <button
          type="button"
          onClick={onRetake}
          className="mt-4 w-full border-2 border-ink py-2 font-receipt text-lg uppercase text-ink hover:bg-ink hover:text-paper transition-colors"
        >
          Retake photo
        </button>
      </Section>
    );
  }

  return (
    <Section>
      <p className="font-receipt text-lg uppercase text-ink">Who was there?</p>
      <p className="mt-1 font-receipt text-sm text-ink-faded">
        You can add more later.
      </p>

      <div className="mt-3 space-y-2">
        {names.map((row, index) => (
          <div key={row.id} className="flex items-center gap-2">
            <input
              value={row.name}
              onChange={(e) => setName(row.id, e.target.value)}
              placeholder="name"
              autoFocus={index === names.length - 1 && row.name === ""}
              className="min-w-0 flex-1 border-b-2 border-ink-faded bg-transparent px-1 py-1 font-hand text-lg text-ink placeholder:text-ink-faded focus:border-ink focus:outline-none"
            />
            <button
              type="button"
              onClick={() => removeName(row.id)}
              aria-label={`Remove ${row.name || "person"}`}
              className="px-2 font-receipt text-lg text-ink-faded hover:text-ink transition-colors"
            >
              ×
            </button>
          </div>
        ))}

        <button
          type="button"
          onClick={() =>
            onChangeNames([...names, { id: makeRowId(names.length), name: "" }])
          }
          className="font-receipt text-base text-ink-faded hover:text-ink transition-colors"
        >
          + add person
        </button>
      </div>

      <div className="mt-6">
        <label className="flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            checked={tipEnabled}
            onChange={(e) => onToggleTip(e.target.checked)}
            className="h-4 w-4 accent-ink"
          />
          <span className="font-receipt text-lg uppercase text-ink">
            Tip not on the bill
          </span>
        </label>

        {tipEnabled && (
          <div className="mt-3 space-y-2 pl-6">
            <div className="flex flex-wrap gap-1.5">
              {TIP_PRESETS.map((pct) => (
                <button
                  key={pct}
                  type="button"
                  onClick={() => onChangeTipPercent(pct)}
                  className={`px-3 py-1 font-receipt text-base transition-colors ${
                    tipPercent === pct
                      ? "font-bold underline text-ink"
                      : "text-ink-muted hover:text-ink"
                  }`}
                >
                  {pct}%
                </button>
              ))}
            </div>
            <TipPercentField
              key={tipPercent}
              percent={tipPercent}
              onChange={onChangeTipPercent}
            />
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={onContinue}
        disabled={isBusy}
        className="mt-6 w-full border-2 border-ink py-2 font-receipt text-lg uppercase text-ink transition-colors hover:bg-ink hover:text-paper disabled:opacity-50"
      >
        {isBusy ? "Reading receipt…" : "Continue"}
      </button>
    </Section>
  );
}
