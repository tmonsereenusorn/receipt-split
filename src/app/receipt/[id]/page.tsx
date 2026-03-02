"use client";

import { use } from "react";
import { useFirestoreReceipt } from "@/hooks/useFirestoreReceipt";
import { calculateBreakdowns } from "@/lib/calculator";
import { generateShareText, generateCsv } from "@/lib/format";
import { ReceiptTape } from "@/components/receipt/ReceiptTape";
import { ReceiptHeader } from "@/components/receipt/ReceiptHeader";
import { PeopleSection } from "@/components/receipt/PeopleSection";
import { ItemsSection } from "@/components/receipt/ItemsSection";
import { TaxTipSection } from "@/components/receipt/TaxTipSection";
import { TotalsSection } from "@/components/receipt/TotalsSection";
import { SplitSection } from "@/components/receipt/SplitSection";
import { ShareSection } from "@/components/receipt/ShareSection";
import { PrintItemsList } from "@/components/receipt/PrintItemsList";

export default function CollaborativeReceiptPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const receipt = useFirestoreReceipt(id);

  if (receipt.loading) {
    return (
      <ReceiptTape>
        <div className="py-12 text-center font-mono text-sm text-zinc-500">
          loading receipt...
        </div>
      </ReceiptTape>
    );
  }

  if (receipt.error) {
    return (
      <ReceiptTape>
        <div className="py-12 text-center font-mono text-sm text-red-400">
          {receipt.error}
        </div>
      </ReceiptTape>
    );
  }

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

  return (
    <ReceiptTape>
      <ReceiptHeader restaurantName={receipt.restaurantName} />

      <div className="no-print">
        <PeopleSection
          people={receipt.people}
          onAdd={receipt.addPerson}
          onUpdate={receipt.updatePerson}
          onDelete={receipt.deletePerson}
        />
      </div>

      {hasItems && (
        <div className="no-print">
          <ItemsSection
            items={receipt.items}
            people={receipt.people}
            onUpdate={receipt.updateItem}
            onDelete={receipt.deleteItem}
            onToggleAssignment={receipt.toggleAssignment}
            onAddItem={() => receipt.addItem("New Item", 1, 0)}
          />
        </div>
      )}

      {hasItems && hasPeople && !allAssigned && unassignedCount > 0 && (
        <div className="no-print py-2 text-center font-mono text-xs text-amber-500">
          {unassignedCount} item{unassignedCount !== 1 ? "s" : ""} unassigned
        </div>
      )}

      {hasItems && (
        <div className="no-print">
          <TaxTipSection taxTip={receipt.taxTip} onChange={receipt.setTaxTip} />
        </div>
      )}

      {hasItems && (
        <TotalsSection items={receipt.items} taxTip={receipt.taxTip} />
      )}

      {allAssigned && hasPeople && (
        <SplitSection breakdowns={breakdowns} />
      )}

      {allAssigned && hasPeople && (
        <ShareSection shareText={shareText} csvText={csvText} />
      )}

      {hasItems && (
        <PrintItemsList items={receipt.items} />
      )}
    </ReceiptTape>
  );
}
