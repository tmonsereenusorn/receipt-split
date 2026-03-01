"use client";

import { PersonBreakdown } from "@/types";
import { Card } from "@/components/ui/Card";
import { formatCents } from "@/lib/format";

interface PersonBreakdownCardProps {
  breakdown: PersonBreakdown;
}

export function PersonBreakdownCard({ breakdown }: PersonBreakdownCardProps) {
  const { person, items, subtotalCents, taxShareCents, tipShareCents, totalCents } =
    breakdown;

  return (
    <Card>
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div
            className="h-3 w-3 rounded-full"
            style={{ backgroundColor: person.color }}
          />
          <h4 className="font-semibold">{person.name}</h4>
        </div>
        <span className="text-lg font-bold">{formatCents(totalCents)}</span>
      </div>
      <div className="space-y-1 text-xs text-gray-500">
        {items.map(({ item, shareCents, splitCount }) => (
          <div key={item.id} className="flex justify-between">
            <span>
              {item.name}
              {splitCount > 1 && (
                <span className="ml-1 text-gray-400">(1/{splitCount})</span>
              )}
            </span>
            <span>{formatCents(shareCents)}</span>
          </div>
        ))}
        {subtotalCents > 0 && (
          <>
            <div className="flex justify-between border-t pt-1 text-gray-600">
              <span>Subtotal</span>
              <span>{formatCents(subtotalCents)}</span>
            </div>
            {taxShareCents > 0 && (
              <div className="flex justify-between">
                <span>Tax</span>
                <span>{formatCents(taxShareCents)}</span>
              </div>
            )}
            {tipShareCents > 0 && (
              <div className="flex justify-between">
                <span>Tip</span>
                <span>{formatCents(tipShareCents)}</span>
              </div>
            )}
          </>
        )}
      </div>
    </Card>
  );
}
