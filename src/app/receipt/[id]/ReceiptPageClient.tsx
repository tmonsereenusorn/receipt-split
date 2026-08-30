"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useFirestoreReceipt } from "@/hooks/useFirestoreReceipt";
import { useRecentReceipts } from "@/hooks/useRecentReceipts";
import { calculateBreakdowns } from "@/lib/calculator";
import { generateShareText, generateCsv } from "@/lib/format";
import { ReceiptTape } from "@/components/receipt/ReceiptTape";
import { ReceiptHeader } from "@/components/receipt/ReceiptHeader";
import { PeopleBar } from "@/components/receipt/PeopleBar";
import { ItemsSection } from "@/components/receipt/ItemsSection";
import { TotalsSection } from "@/components/receipt/TotalsSection";
import { SplitSection } from "@/components/receipt/SplitSection";
import { ShareSection } from "@/components/receipt/ShareSection";
import { PrintItemsList } from "@/components/receipt/PrintItemsList";

export default function ReceiptPageClient({ id }: { id: string }) {
  const receipt = useFirestoreReceipt(id);
  const { upsert: upsertRecent } = useRecentReceipts();
  const [activePerson, setActivePerson] = useState<string | null>(null);
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);
  const [collapseKey, setCollapseKey] = useState(0);
  const resolvedActivePerson = activePerson && receipt.people.some(p => p.id === activePerson)
    ? activePerson : null;

  useEffect(() => {
    if (!receipt.loading && !receipt.error) {
      upsertRecent(id, receipt.restaurantName);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, receipt.loading]);

  if (receipt.loading) {
    return (
      <ReceiptTape>
        <div className="py-12 text-center font-receipt text-base text-ink-muted">
          loading receipt...
        </div>
      </ReceiptTape>
    );
  }

  // Only a subscription failure replaces the screen; a failed write shows a
  // dismissible banner below, because the receipt is still usable.
  if (receipt.error) {
    return (
      <ReceiptTape>
        <div className="py-12 text-center font-receipt text-base text-accent">
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
      ? calculateBreakdowns(receipt.items, receipt.people, receipt.charges, receipt.tip)
      : [];

  // window.location rather than a hardcoded origin, so a link copied from a
  // preview deployment or localhost points back at where it was copied from.
  // Guarded because this component still renders on the server.
  const shareUrl =
    typeof window !== "undefined"
      ? window.location.href
      : `https://shplit.vercel.app/receipt/${id}`;

  const shareText =
    breakdowns.length > 0
      ? generateShareText(
          receipt.items,
          receipt.charges,
          receipt.tip,
          breakdowns,
          receipt.currency,
          shareUrl,
          receipt.restaurantName
        )
      : "";

  const csvText =
    breakdowns.length > 0
      ? generateCsv(receipt.items, receipt.charges, receipt.tip, breakdowns, receipt.currency)
      : "";

  const unassignedCount = receipt.items.filter(
    (item) => item.assignedTo.length === 0
  ).length;

  function collapseAll() {
    setExpandedItemId(null);
    setCollapseKey(k => k + 1);
  }

  return (
    <ReceiptTape onClick={collapseAll}>
      {receipt.writeError && (
        <div className="no-print flex items-start gap-2 border-b border-ink-faded px-4 py-2">
          <p className="flex-1 font-receipt text-base text-accent">
            {receipt.writeError}
          </p>
          <button
            type="button"
            onClick={receipt.dismissWriteError}
            aria-label="Dismiss"
            className="font-receipt text-base text-ink-faded hover:text-ink"
          >
            ×
          </button>
        </div>
      )}
      <div className="no-print px-3 pt-3">
        <Link
          href="/"
          className="inline-flex items-center gap-1 font-receipt text-base text-ink-muted underline transition-colors hover:text-ink"
        >
          <span aria-hidden="true">&larr;</span> new shplit
        </Link>
      </div>

      <ReceiptHeader restaurantName={receipt.restaurantName} onChangeName={receipt.setRestaurantName} currency={receipt.currency} onChangeCurrency={receipt.setCurrency}>
        <PeopleBar
          people={receipt.people}
          items={receipt.items}
          activePerson={resolvedActivePerson}
          onSelectPerson={(id) => {
            setActivePerson(id);
            setExpandedItemId(null);
            setCollapseKey(k => k + 1);
          }}
          onAdd={receipt.addPerson}
          onUpdate={receipt.updatePerson}
          onDelete={(id) => {
            receipt.deletePerson(id);
          }}
        />
      </ReceiptHeader>

      {hasItems && (
        <div className="no-print" onClick={e => e.stopPropagation()}>
          <ItemsSection
            items={receipt.items}
            people={receipt.people}
            activePerson={resolvedActivePerson}
            unassignedCount={unassignedCount}
            expandedId={expandedItemId}
            currency={receipt.currency}
            onToggleExpand={(id) => {
              const next = expandedItemId === id ? null : id;
              setExpandedItemId(next);
              if (next) setCollapseKey(k => k + 1);
            }}
            onUpdate={receipt.updateItem}
            onDelete={receipt.deleteItem}
            onToggleAssignment={receipt.toggleAssignment}
            onAddItem={() => receipt.addItem("New Item", 1, 0)}
            onReorder={receipt.reorderItem}
          />
        </div>
      )}

      {hasItems && (
        <div onClick={e => e.stopPropagation()}>
          <TotalsSection
            items={receipt.items}
            charges={receipt.charges}
            tip={receipt.tip}
            currency={receipt.currency}
            onChangeTip={receipt.setTip}
            onUpdateCharge={receipt.updateCharge}
            onDeleteCharge={receipt.deleteCharge}
            onAddCharge={receipt.addCharge}
            collapseKey={collapseKey}
            onRowExpand={() => setExpandedItemId(null)}
          />
        </div>
      )}

      {hasPeople && (
        <SplitSection breakdowns={breakdowns} allAssigned={allAssigned} currency={receipt.currency} />
      )}

      <ShareSection
        shareText={shareText || undefined}
        csvText={csvText || undefined}
      />

      {hasItems && (
        <PrintItemsList items={receipt.items} currency={receipt.currency} />
      )}
    </ReceiptTape>
  );
}
