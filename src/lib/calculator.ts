import {
  ReceiptItem,
  Person,
  ReceiptCharge,
  Tip,
  PersonBreakdown,
} from "@/types";

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
 * Sum every charge on the receipt.
 *
 * Charges are always cash, so this is a plain sum — there is no percent mode to
 * resolve. Only the tip has one.
 */
export function getChargesTotalCents(charges: ReceiptCharge[]): number {
  return charges.reduce((sum, charge) => sum + charge.amountCents, 0);
}

/**
 * Calculate the effective tip in cents.
 * If tip.isPercent, compute from the subtotal.
 *
 * Deliberately takes the subtotal rather than the running total: a percentage
 * tip compounding on a service charge would inflate the bill.
 */
export function getEffectiveTipCents(tip: Tip, subtotalCents: number): number {
  if (tip.isPercent) {
    return Math.round((subtotalCents * tip.percent) / 100);
  }
  return tip.cents;
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
  charges: ReceiptCharge[],
  tip: Tip
): PersonBreakdown[] {
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
      chargeShares: [],
      tipShareCents: 0,
      totalCents: 0,
    };
  });

  // Compute charges and tip from assigned items only, so each person's share is
  // proportional to what they actually ordered rather than to unassigned items.
  const personSubtotals = breakdowns.map((b) => b.subtotalCents);
  const totalPersonSubtotal = personSubtotals.reduce((a, b) => a + b, 0);

  // Each charge is distributed independently, so every charge's shares sum
  // exactly to that charge rather than only the lumped total being exact.
  for (const charge of charges) {
    const shares = distributeProportionally(
      charge.amountCents,
      personSubtotals,
      totalPersonSubtotal
    );
    for (let i = 0; i < breakdowns.length; i++) {
      breakdowns[i].chargeShares.push({
        chargeId: charge.id,
        label: charge.label,
        shareCents: shares[i],
      });
    }
  }

  const tipShares = distributeProportionally(
    getEffectiveTipCents(tip, totalPersonSubtotal),
    personSubtotals,
    totalPersonSubtotal
  );

  for (let i = 0; i < breakdowns.length; i++) {
    breakdowns[i].tipShareCents = tipShares[i];
    breakdowns[i].totalCents =
      breakdowns[i].subtotalCents +
      breakdowns[i].chargeShares.reduce((s, c) => s + c.shareCents, 0) +
      tipShares[i];
  }

  return breakdowns;
}
