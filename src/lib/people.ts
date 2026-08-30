import { ReceiptItem } from "@/types";

/**
 * How many items a person is assigned to.
 *
 * Shown before removing them, because deleting a person also strips them from
 * every item — the consequence should be visible before the confirming tap
 * rather than discovered afterwards.
 */
export function countAssignedItems(
  items: ReceiptItem[],
  personId: string
): number {
  return items.filter((item) => item.assignedTo.includes(personId)).length;
}
