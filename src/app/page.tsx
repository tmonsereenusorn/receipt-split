"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createReceipt } from "@/lib/firestore";
import { ReceiptTape } from "@/components/receipt/ReceiptTape";
import { ReceiptHeader } from "@/components/receipt/ReceiptHeader";
import { ScanSection, ScanResult } from "@/components/receipt/ScanSection";

export default function LandingPage() {
  const router = useRouter();
  const [isCreating, setIsCreating] = useState(false);

  async function handleScanResult(result: ScanResult) {
    setIsCreating(true);
    const id = await createReceipt({
      items: result.items,
      restaurantName: result.restaurantName,
      ocrText: result.ocrText,
      imageDataUrl: result.imageDataUrl,
    });
    router.push(`/receipt/${id}`);
  }

  async function handleSkip() {
    setIsCreating(true);
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
  }

  return (
    <ReceiptTape>
      <ReceiptHeader />
      {isCreating ? (
        <div className="py-8 text-center font-mono text-sm text-zinc-500">
          creating receipt...
        </div>
      ) : (
        <div className="no-print">
          <ScanSection onScanResult={handleScanResult} onSkip={handleSkip} />
        </div>
      )}
    </ReceiptTape>
  );
}
