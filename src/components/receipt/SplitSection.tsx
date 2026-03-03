"use client";

import { PersonBreakdown } from "@/types";
import { formatCents } from "@/lib/format";
import { Section } from "./Section";

interface SplitSectionProps {
  breakdowns: PersonBreakdown[];
  allAssigned?: boolean;
}

export function SplitSection({ breakdowns, allAssigned }: SplitSectionProps) {
  if (breakdowns.length === 0 || breakdowns.every((b) => b.totalCents === 0)) {
    return null;
  }

  return (
    <Section>
      <div className="receipt-separator mb-3 text-center" aria-hidden="true">
        - - - - - SPLIT - - - - -
      </div>
      {!allAssigned && (
        <p className="mb-3 text-center font-hand text-sm italic text-ink-muted">
          * totals may change as items get assigned
        </p>
      )}
      <div className="space-y-3">
        {breakdowns.map((breakdown, i) => (
          <div key={breakdown.person.id}>
            <PersonSplit breakdown={breakdown} />
            {i < breakdowns.length - 1 && (
              <div className="receipt-separator mt-3 text-center text-sm" aria-hidden="true">
                - - - - - - - - - -
              </div>
            )}
          </div>
        ))}
      </div>
    </Section>
  );
}

function PersonSplit({ breakdown }: { breakdown: PersonBreakdown }) {
  const { person, items, subtotalCents, taxShareCents, tipShareCents, totalCents } = breakdown;

  if (totalCents === 0) return null;

  return (
    <div className="print-no-break space-y-1">
      {/* Person header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className="person-dot inline-flex h-6 w-6 items-center justify-center rounded-full font-hand text-sm font-bold"
            style={{ backgroundColor: person.color, color: '#faf5e8' }}
          >
            {person.name.charAt(0).toUpperCase()}
          </span>
          <span className="font-hand text-lg font-bold" style={{ color: person.color }}>{person.name}</span>
        </div>
        <span className="font-receipt text-lg font-bold text-ink">
          {formatCents(totalCents)}
        </span>
      </div>

      {/* Item breakdown */}
      <div className="space-y-0.5 pl-6">
        {items.map(({ item, shareCents, splitCount }) => (
          <div key={item.id} className="print-muted flex items-baseline font-receipt text-base text-ink-muted">
            <span className="shrink-0 truncate">
              {item.name}
              {splitCount > 1 && (
                <span className="text-ink-faded"> (1/{splitCount})</span>
              )}
            </span>
            <span className="mx-1 flex-1 overflow-hidden whitespace-nowrap text-ink-faded" aria-hidden="true">{"·".repeat(50)}</span>
            <span className="shrink-0 ml-2">{formatCents(shareCents)}</span>
          </div>
        ))}
        {taxShareCents > 0 && (
          <div className="print-muted flex items-baseline font-receipt text-base text-ink-muted">
            <span className="shrink-0">tax</span>
            <span className="mx-1 flex-1 overflow-hidden whitespace-nowrap text-ink-faded" aria-hidden="true">{"·".repeat(50)}</span>
            <span className="shrink-0">{formatCents(taxShareCents)}</span>
          </div>
        )}
        {tipShareCents > 0 && (
          <div className="print-muted flex items-baseline font-receipt text-base text-ink-muted">
            <span className="shrink-0">tip</span>
            <span className="mx-1 flex-1 overflow-hidden whitespace-nowrap text-ink-faded" aria-hidden="true">{"·".repeat(50)}</span>
            <span className="shrink-0">{formatCents(tipShareCents)}</span>
          </div>
        )}
      </div>
    </div>
  );
}
