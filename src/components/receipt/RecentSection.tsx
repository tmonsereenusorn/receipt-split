"use client";

import Link from "next/link";
import { RecentReceipt } from "@/hooks/useRecentReceipts";
import { timeAgo } from "@/lib/format";
import { Section } from "./Section";

interface RecentSectionProps {
  recents: RecentReceipt[];
  onRemove: (id: string) => void;
}

export function RecentSection({ recents, onRemove }: RecentSectionProps) {
  if (recents.length === 0) return null;

  return (
    <Section>
      <h3 className="mb-3 font-receipt text-base uppercase text-ink-muted">
        Recent
      </h3>
      <div className="space-y-1">
        {recents.map((r) => (
          <div key={r.id} className="group flex items-center">
            <Link
              href={`/receipt/${r.id}`}
              className="flex min-w-0 flex-1 items-baseline justify-between py-1.5 font-receipt text-lg text-ink transition-colors hover:text-ink-muted"
            >
              <span className="truncate text-ink group-hover:text-ink-muted">
                {r.name}
              </span>
              <span className="ml-3 shrink-0 text-base text-ink-faded">
                {timeAgo(r.viewedAt)}
              </span>
            </Link>
            <button
              type="button"
              onClick={() => onRemove(r.id)}
              className="ml-2 shrink-0 px-1 font-receipt text-base text-ink-faded hover:text-accent"
              aria-label={`Remove ${r.name} from recent`}
            >
              &times;
            </button>
          </div>
        ))}
      </div>
    </Section>
  );
}
