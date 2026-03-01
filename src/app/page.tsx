"use client";

import { useReceipt } from "@/hooks/useReceipt";
import { calculateBreakdowns } from "@/lib/calculator";
import { generateShareText, generateCsv } from "@/lib/format";
import { ReceiptTape } from "@/components/receipt/ReceiptTape";
import { ReceiptHeader } from "@/components/receipt/ReceiptHeader";
import { ScanSection } from "@/components/receipt/ScanSection";
import { PeopleSection } from "@/components/receipt/PeopleSection";
import { ItemsSection } from "@/components/receipt/ItemsSection";
import { TaxTipSection } from "@/components/receipt/TaxTipSection";
import { TotalsSection } from "@/components/receipt/TotalsSection";
import { SplitSection } from "@/components/receipt/SplitSection";
import { ShareSection } from "@/components/receipt/ShareSection";

export default function ReceiptPage() {
  const receipt = useReceipt();

  const hasItems = receipt.items.length > 0;
  const hasPeople = receipt.people.length > 0;
  const allAssigned =
    hasItems && receipt.items.every((item) => item.assignedTo.length > 0);

  const breakdowns =
    hasItems && hasPeople
      ? calculateBreakdowns(receipt.items, receipt.people, receipt.taxTip)
      : [];

  const shareText =
    breakdowns.length > 0
      ? generateShareText(receipt.items, receipt.taxTip, breakdowns)
      : "";

  const csvText =
    breakdowns.length > 0
      ? generateCsv(receipt.items, receipt.taxTip, breakdowns)
      : "";

  const unassignedCount = receipt.items.filter(
    (item) => item.assignedTo.length === 0
  ).length;

  function handleScanComplete() {
    // Items are already set via context
  }

  function handleSkipScan() {
    if (receipt.items.length === 0) {
      receipt.addItem("New Item", 1, 0);
    }
  }

  function handleStartOver() {
    receipt.reset();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <ReceiptTape>
      <ReceiptHeader />

      {!hasItems && (
        <ScanSection onComplete={handleScanComplete} onSkip={handleSkipScan} />
      )}

      {hasItems && (
        <PeopleSection
          people={receipt.people}
          onAdd={receipt.addPerson}
          onUpdate={receipt.updatePerson}
          onDelete={receipt.deletePerson}
        />
      )}

      {hasItems && (
        <ItemsSection
          items={receipt.items}
          people={receipt.people}
          onUpdate={receipt.updateItem}
          onDelete={receipt.deleteItem}
          onToggleAssignment={receipt.toggleAssignment}
          onAddItem={() => receipt.addItem("New Item", 1, 0)}
        />
      )}

      {hasItems && hasPeople && !allAssigned && unassignedCount > 0 && (
        <div className="py-2 text-center font-mono text-xs text-amber-500">
          {unassignedCount} item{unassignedCount !== 1 ? "s" : ""} unassigned
        </div>
      )}

      {hasItems && (
        <TaxTipSection taxTip={receipt.taxTip} onChange={receipt.setTaxTip} />
      )}

      {hasItems && (
        <TotalsSection items={receipt.items} taxTip={receipt.taxTip} />
      )}

      {allAssigned && hasPeople && (
        <SplitSection breakdowns={breakdowns} />
      )}

      {allAssigned && hasPeople && (
        <ShareSection
          shareText={shareText}
          csvText={csvText}
          onStartOver={handleStartOver}
        />
      )}
    </ReceiptTape>
  );
}
