"use client";

import { Section } from "./Section";

/** Common tip percentages, matching the TIP row on the receipt page. */
const TIP_PRESETS = [15, 18, 20, 25];

interface SetupSectionProps {
  names: string[];
  onChangeNames: (names: string[]) => void;
  tipEnabled: boolean;
  onToggleTip: (enabled: boolean) => void;
  tipPercent: number;
  onChangeTipPercent: (percent: number) => void;
  onContinue: () => void;
  isBusy: boolean;
  scanError: string | null;
  onRetake: () => void;
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
  function setName(index: number, value: string) {
    onChangeNames(names.map((n, i) => (i === index ? value : n)));
  }

  function removeName(index: number) {
    onChangeNames(names.filter((_, i) => i !== index));
  }

  // A scan that already failed cannot be continued past — otherwise the user
  // fills the form and Continue lands on an empty receipt.
  if (scanError) {
    return (
      <Section>
        <p className="font-receipt text-lg uppercase text-ink">
          Couldn&apos;t read that receipt
        </p>
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
        {names.map((name, index) => (
          <div key={index} className="flex items-center gap-2">
            <input
              value={name}
              onChange={(e) => setName(index, e.target.value)}
              placeholder="name"
              autoFocus={index === names.length - 1 && name === ""}
              className="min-w-0 flex-1 border-b-2 border-ink-faded bg-transparent px-1 py-1 font-hand text-lg text-ink placeholder:text-ink-faded focus:border-ink focus:outline-none"
            />
            <button
              type="button"
              onClick={() => removeName(index)}
              aria-label={`Remove ${name || "person"}`}
              className="px-2 font-receipt text-lg text-ink-faded hover:text-ink transition-colors"
            >
              ×
            </button>
          </div>
        ))}

        <button
          type="button"
          onClick={() => onChangeNames([...names, ""])}
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
            <div className="flex items-center gap-1">
              <input
                type="number"
                step="0.1"
                min="0"
                max="100"
                value={tipPercent}
                aria-label="Tip percentage"
                onChange={(e) =>
                  onChangeTipPercent(Math.max(0, parseFloat(e.target.value) || 0))
                }
                className="w-16 border-b-2 border-ink-faded bg-transparent px-1 py-1 font-receipt text-lg text-ink focus:border-ink focus:outline-none"
              />
              <span className="font-receipt text-sm text-ink-faded">%</span>
            </div>
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
