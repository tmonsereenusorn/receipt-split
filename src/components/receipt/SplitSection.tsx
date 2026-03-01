"use client";

import { PersonBreakdown } from "@/types";
import { formatCents } from "@/lib/format";
import { Section } from "./Section";

interface SplitSectionProps {
  breakdowns: PersonBreakdown[];
}

export function SplitSection({ breakdowns }: SplitSectionProps) {
  if (breakdowns.length === 0 || breakdowns.every((b) => b.totalCents === 0)) {
    return null;
  }

  return (
    <Section>
      <div className="print-decorative mb-3 text-center font-mono text-xs text-zinc-600 select-none" aria-hidden="true">
        ——— SPLIT ———
      </div>
      <div className="space-y-4">
        {breakdowns.map((breakdown) => (
          <PersonSplit key={breakdown.person.id} breakdown={breakdown} />
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
            className="person-dot inline-block h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: person.color }}
          />
          <span className="text-sm font-semibold text-zinc-200">{person.name}</span>
        </div>
        <span className="font-mono text-sm font-bold text-zinc-100">
          {formatCents(totalCents)}
        </span>
      </div>

      {/* Item breakdown */}
      <div className="space-y-0.5 pl-5">
        {items.map(({ item, shareCents, splitCount }) => (
          <div key={item.id} className="print-muted flex justify-between font-mono text-xs text-zinc-500">
            <span className="truncate">
              {item.name}
              {splitCount > 1 && (
                <span className="text-zinc-600"> (1/{splitCount})</span>
              )}
            </span>
            <span className="ml-2">{formatCents(shareCents)}</span>
          </div>
        ))}
        {taxShareCents > 0 && (
          <div className="print-muted flex justify-between font-mono text-xs text-zinc-500">
            <span>tax</span>
            <span>{formatCents(taxShareCents)}</span>
          </div>
        )}
        {tipShareCents > 0 && (
          <div className="print-muted flex justify-between font-mono text-xs text-zinc-500">
            <span>tip</span>
            <span>{formatCents(tipShareCents)}</span>
          </div>
        )}
      </div>
    </div>
  );
}
