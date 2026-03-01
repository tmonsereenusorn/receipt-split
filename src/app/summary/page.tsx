"use client";

import { useRouter } from "next/navigation";
import { useReceipt } from "@/hooks/useReceipt";
import { calculateBreakdowns } from "@/lib/calculator";
import { generateShareText, generateCsv } from "@/lib/format";
import { Button } from "@/components/ui/Button";
import { ReceiptSummary } from "@/components/summary/ReceiptSummary";
import { PersonBreakdownCard } from "@/components/summary/PersonBreakdownCard";
import { ShareActions } from "@/components/summary/ShareActions";

export default function SummaryPage() {
  const router = useRouter();
  const receipt = useReceipt();

  const breakdowns = calculateBreakdowns(
    receipt.items,
    receipt.people,
    receipt.taxTip
  );

  const shareText = generateShareText(
    receipt.items,
    receipt.taxTip,
    breakdowns
  );

  const csvText = generateCsv(
    receipt.items,
    receipt.taxTip,
    breakdowns
  );

  function handleStartOver() {
    receipt.reset();
    router.push("/");
  }

  if (receipt.items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 py-12">
        <p className="text-gray-500">No receipt data yet.</p>
        <Button onClick={() => router.push("/")}>Scan a Receipt</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Receipt Split Summary</h1>
        <Button variant="ghost" size="sm" onClick={() => router.push("/assign")} className="no-print">
          Back
        </Button>
      </div>

      <ReceiptSummary items={receipt.items} taxTip={receipt.taxTip} />

      <div>
        <h2 className="mb-3 text-sm font-semibold text-gray-700">Per Person</h2>
        <div className="grid grid-cols-1 gap-3 print:grid-cols-2 sm:grid-cols-2">
          {breakdowns.map((breakdown) => (
            <PersonBreakdownCard
              key={breakdown.person.id}
              breakdown={breakdown}
            />
          ))}
        </div>
      </div>

      <div className="no-print">
        <ShareActions shareText={shareText} csvText={csvText} onStartOver={handleStartOver} />
      </div>
    </div>
  );
}
