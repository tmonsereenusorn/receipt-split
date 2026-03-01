"use client";

import { useRouter } from "next/navigation";
import { useReceipt } from "@/hooks/useReceipt";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { PeopleManager } from "@/components/assign/PeopleManager";
import { ItemTable } from "@/components/assign/ItemTable";
import { TaxTipInput } from "@/components/assign/TaxTipInput";
import { getSubtotalCents, getEffectiveTaxCents, getEffectiveTipCents } from "@/lib/calculator";
import { formatCents } from "@/lib/format";

export default function AssignPage() {
  const router = useRouter();
  const receipt = useReceipt();

  const hasItems = receipt.items.length > 0;
  const hasPeople = receipt.people.length > 0;
  const allAssigned =
    hasItems && receipt.items.every((item) => item.assignedTo.length > 0);
  const canContinue = hasItems && hasPeople && allAssigned;

  const unassignedCount = receipt.items.filter(
    (item) => item.assignedTo.length === 0
  ).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Assign Items</h1>
          <p className="text-sm text-gray-500">
            Add people and assign items to each person
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => router.push("/")}>
          Back
        </Button>
      </div>

      <Card>
        <PeopleManager
          people={receipt.people}
          onAdd={receipt.addPerson}
          onUpdate={receipt.updatePerson}
          onDelete={receipt.deletePerson}
        />
      </Card>

      <ItemTable
        items={receipt.items}
        people={receipt.people}
        onUpdate={receipt.updateItem}
        onDelete={receipt.deleteItem}
        onToggleAssignment={receipt.toggleAssignment}
        onReorder={receipt.setItems}
        onAddItem={() => receipt.addItem("New Item", 1, 0)}
      />

      <TaxTipInput taxTip={receipt.taxTip} onChange={receipt.setTaxTip} />

      {hasItems && (() => {
        const subtotal = getSubtotalCents(receipt.items);
        const tax = getEffectiveTaxCents(receipt.taxTip, subtotal);
        const tip = getEffectiveTipCents(receipt.taxTip, subtotal);
        const total = subtotal + tax + tip;
        return (
          <Card>
            <h3 className="mb-2 text-sm font-semibold text-gray-700">Running Total</h3>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Subtotal</span>
                <span>{formatCents(subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">
                  Tax{receipt.taxTip.taxIsPercent ? ` (${receipt.taxTip.taxPercent}%)` : ""}
                </span>
                <span>{formatCents(tax)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">
                  Tip{receipt.taxTip.tipIsPercent ? ` (${receipt.taxTip.tipPercent}%)` : ""}
                </span>
                <span>{formatCents(tip)}</span>
              </div>
              <div className="flex justify-between border-t pt-1.5 font-bold">
                <span>Total</span>
                <span>{formatCents(total)}</span>
              </div>
            </div>
          </Card>
        );
      })()}

      {!canContinue && hasItems && hasPeople && unassignedCount > 0 && (
        <p className="text-center text-sm text-amber-600">
          {unassignedCount} item{unassignedCount !== 1 ? "s" : ""} not assigned
          to anyone
        </p>
      )}

      <Button
        onClick={() => router.push("/summary")}
        disabled={!canContinue}
        className="w-full"
        size="lg"
      >
        View Summary
      </Button>
    </div>
  );
}
