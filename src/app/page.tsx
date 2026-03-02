"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createReceipt } from "@/lib/firestore";
import { ReceiptTape } from "@/components/receipt/ReceiptTape";
import { ScanSection, ScanResult } from "@/components/receipt/ScanSection";
import { useRecentReceipts } from "@/hooks/useRecentReceipts";
import { RecentSection } from "@/components/receipt/RecentSection";

export default function LandingPage() {
  const router = useRouter();
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { recents, remove: removeRecent } = useRecentReceipts();

  async function handleScanResult(result: ScanResult) {
    setIsCreating(true);
    setError(null);
    try {
      const id = await createReceipt({
        items: result.items,
        restaurantName: result.restaurantName,
        ocrText: result.ocrText,
      });
      router.push(`/receipt/${id}`);
    } catch {
      setError("Failed to create receipt. Check your connection and try again.");
      setIsCreating(false);
    }
  }

  async function handleSkip() {
    setIsCreating(true);
    setError(null);
    try {
      const id = await createReceipt({
        items: [
          {
            id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            name: "New Item",
            quantity: 1,
            priceCents: 0,
            assignedTo: [],
          },
        ],
      });
      router.push(`/receipt/${id}`);
    } catch {
      setError("Failed to create receipt. Check your connection and try again.");
      setIsCreating(false);
    }
  }

  return (
    <ReceiptTape>
      <div className="py-8 text-center">
        <h1 className="font-mono text-3xl font-bold uppercase tracking-[0.3em] text-amber-500">
          Shplit
        </h1>
        <p className="mt-1 font-mono text-xs text-zinc-600">split any receipt</p>
        <div className="mt-3 font-mono text-xs text-zinc-600 select-none" aria-hidden="true">
          ================================
        </div>
      </div>
      {error && (
        <p className="py-2 text-center font-mono text-xs text-red-400">{error}</p>
      )}
      {isCreating ? (
        <div className="py-8 text-center font-mono text-sm text-zinc-500">
          creating receipt...
        </div>
      ) : (
        <div className="no-print">
          <ScanSection onScanResult={handleScanResult} onSkip={handleSkip} />
        </div>
      )}
      <RecentSection recents={recents} onRemove={removeRecent} />
    </ReceiptTape>
  );
}
