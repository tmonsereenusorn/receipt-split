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
      <h3 className="mb-3 text-xs font-medium uppercase tracking-wider text-zinc-500">
        Recent
      </h3>
      <div className="space-y-1">
        {recents.map((r) => (
          <div key={r.id} className="group flex items-center">
            <Link
              href={`/receipt/${r.id}`}
              className="flex min-w-0 flex-1 items-center justify-between py-1.5 font-mono text-sm transition-colors hover:text-amber-500"
            >
              <span className="truncate text-zinc-200 group-hover:text-amber-500">
                {r.name}
              </span>
              <span className="ml-3 shrink-0 text-xs text-zinc-600">
                {timeAgo(r.viewedAt)}
              </span>
            </Link>
            <button
              type="button"
              onClick={() => onRemove(r.id)}
              className="ml-2 shrink-0 px-1 text-xs text-zinc-600 opacity-0 transition-opacity hover:text-zinc-400 group-hover:opacity-100"
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
