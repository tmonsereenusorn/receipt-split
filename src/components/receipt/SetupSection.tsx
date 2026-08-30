"use client";

import { useState } from "react";
import { Section } from "./Section";

/** Stable row id; only ever used as a React key and for local edits. */
export function makeRowId(index: number): string {
  return `row-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 6)}`;
}

/**
 * A hand-marked answer: a check or a cross, circled in red pen.
 *
 * Drawn as strokes rather than set as glyphs (✓/✗), which read as typeset and
 * would sit at odds with the printed receipt type around them. The circle
 * overshoots its own start and the whole mark is rotated slightly, because a
 * real circled answer is never closed cleanly.
 */
function PenAnswer({
  kind,
  selected,
  label,
  onSelect,
}: {
  kind: "yes" | "no";
  selected: boolean;
  label: string;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      aria-label={label}
      className="group flex flex-col items-center gap-1 px-2 py-1"
    >
      <svg
        viewBox="0 0 56 56"
        className="h-14 w-14 overflow-visible"
        aria-hidden="true"
      >
        {kind === "yes" ? (
          <path
            d="M17 29 L25 37 L40 19"
            className={`pen-mark ${selected ? "" : "opacity-30"}`}
            style={selected ? undefined : { stroke: "var(--color-ink-faded)" }}
          />
        ) : (
          <g
            className={`pen-mark ${selected ? "" : "opacity-30"}`}
            style={selected ? undefined : { stroke: "var(--color-ink-faded)" }}
          >
            <path d="M19 19 L37 37" />
            <path d="M37 19 L19 37" />
          </g>
        )}

        {selected && (
          <path
            className="pen-circle"
            pathLength={1}
            d="M42 14 C50 22 48 40 34 45 C20 50 7 41 8 28 C9 16 21 8 33 10 C41 11 45 15 46 20"
          />
        )}
      </svg>

      <span
        className={`font-receipt text-base uppercase ${
          selected ? "text-ink" : "text-ink-muted"
        }`}
      >
        {label}
      </span>
    </button>
  );
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
  /** null until the user answers; Continue stays disabled while it is. */
  tipOnBill: boolean | null;
  onAnswerTipOnBill: (onBill: boolean) => void;
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
  tipOnBill,
  onAnswerTipOnBill,
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
        <p className="font-receipt text-lg uppercase text-ink">
          Was the tip on the bill?
        </p>

        <div className="mt-1 flex items-start gap-4">
          <PenAnswer
            kind="yes"
            label="Yes"
            selected={tipOnBill === true}
            onSelect={() => onAnswerTipOnBill(true)}
          />
          <PenAnswer
            kind="no"
            label="No"
            selected={tipOnBill === false}
            onSelect={() => onAnswerTipOnBill(false)}
          />
        </div>

        {tipOnBill === false && (
          <div className="mt-3 space-y-2">
            <p className="font-receipt text-sm text-ink-faded">
              How much are you adding?
            </p>
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
        disabled={isBusy || tipOnBill === null}
        className="mt-6 w-full border-2 border-ink py-2 font-receipt text-lg uppercase text-ink transition-colors hover:bg-ink hover:text-paper disabled:opacity-50"
      >
        {isBusy
          ? "Reading receipt…"
          : tipOnBill === null
            ? "Answer the tip question"
            : "Continue"}
      </button>
    </Section>
  );
}
