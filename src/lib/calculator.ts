import { ReceiptItem, Person, TaxTip, PersonBreakdown } from "@/types";

/**
 * Calculate per-person share of a single item's total cost (qty * price).
 * Uses integer division with the last person getting the remainder.
 */
function splitItemCents(
  totalCents: number,
  splitCount: number,
  index: number
): number {
  const base = Math.floor(totalCents / splitCount);
  const remainder = totalCents - base * splitCount;
  // Last person gets remainder
  return index < splitCount - 1 ? base : base + remainder;
}

/**
 * Distribute an amount proportionally across people based on their subtotals.
 * Uses "last person gets remainder" to guarantee the total is exact.
 */
function distributeProportionally(
  amountCents: number,
  subtotals: number[],
  totalSubtotal: number
): number[] {
  if (totalSubtotal === 0 || subtotals.length === 0) {
    return subtotals.map(() => 0);
  }

  const shares: number[] = [];
  let distributed = 0;

  for (let i = 0; i < subtotals.length; i++) {
    if (i < subtotals.length - 1) {
      const share = Math.round((amountCents * subtotals[i]) / totalSubtotal);
      shares.push(share);
      distributed += share;
    } else {
      // Last person gets the remainder
      shares.push(amountCents - distributed);
    }
  }

  return shares;
}

/**
 * Calculate the effective tax in cents.
 * If taxIsPercent, compute from subtotal.
 */
export function getEffectiveTaxCents(
  taxTip: TaxTip,
  subtotalCents: number
): number {
  if (taxTip.taxIsPercent) {
    return Math.round((subtotalCents * taxTip.taxPercent) / 100);
  }
  return taxTip.taxCents;
}

/**
 * Calculate the effective tip in cents.
 * If tipIsPercent, compute from subtotal.
 */
export function getEffectiveTipCents(
  taxTip: TaxTip,
  subtotalCents: number
): number {
  if (taxTip.tipIsPercent) {
    return Math.round((subtotalCents * taxTip.tipPercent) / 100);
  }
  return taxTip.tipCents;
}

/**
 * Calculate the overall receipt subtotal (sum of all items: qty * price).
 */
export function getSubtotalCents(items: ReceiptItem[]): number {
  return items.reduce(
    (sum, item) => sum + item.quantity * item.priceCents,
    0
  );
}

/**
 * Calculate per-person breakdowns.
 */
export function calculateBreakdowns(
  items: ReceiptItem[],
  people: Person[],
  taxTip: TaxTip
): PersonBreakdown[] {
  const subtotalCents = getSubtotalCents(items);
  const effectiveTaxCents = getEffectiveTaxCents(taxTip, subtotalCents);
  const effectiveTipCents = getEffectiveTipCents(taxTip, subtotalCents);

  // Build per-person item shares
  const breakdowns: PersonBreakdown[] = people.map((person) => {
    const personItems: PersonBreakdown["items"] = [];
    let personSubtotal = 0;

    for (const item of items) {
      const assigneeIndex = item.assignedTo.indexOf(person.id);
      if (assigneeIndex === -1) continue;

      const itemTotal = item.quantity * item.priceCents;
      const splitCount = item.assignedTo.length;
      const shareCents = splitItemCents(
        itemTotal,
        splitCount,
        assigneeIndex
      );

      personItems.push({ item, shareCents, splitCount });
      personSubtotal += shareCents;
    }

    return {
      person,
      items: personItems,
      subtotalCents: personSubtotal,
      taxShareCents: 0,
      tipShareCents: 0,
      totalCents: 0,
    };
  });

  // Distribute tax and tip proportionally
  const personSubtotals = breakdowns.map((b) => b.subtotalCents);
  const totalPersonSubtotal = personSubtotals.reduce((a, b) => a + b, 0);

  const taxShares = distributeProportionally(
    effectiveTaxCents,
    personSubtotals,
    totalPersonSubtotal
  );
  const tipShares = distributeProportionally(
    effectiveTipCents,
    personSubtotals,
    totalPersonSubtotal
  );

  for (let i = 0; i < breakdowns.length; i++) {
    breakdowns[i].taxShareCents = taxShares[i];
    breakdowns[i].tipShareCents = tipShares[i];
    breakdowns[i].totalCents =
      breakdowns[i].subtotalCents + taxShares[i] + tipShares[i];
  }

  return breakdowns;
}
