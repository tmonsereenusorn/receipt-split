import { describe, it, expect } from "vitest";
import { countAssignedItems } from "../people";
import { ReceiptItem } from "@/types";

const item = (id: string, assignedTo: string[]): ReceiptItem => ({
  id,
  name: id,
  quantity: 1,
  priceCents: 100,
  assignedTo,
});

describe("countAssignedItems", () => {
  it("counts the items a person is on", () => {
    const items = [item("a", ["p1"]), item("b", ["p1", "p2"]), item("c", ["p2"])];

    expect(countAssignedItems(items, "p1")).toBe(2);
  });

  it("returns 0 when the person is on nothing", () => {
    // Drives the shorter confirmation: there is no consequence to warn about.
    expect(countAssignedItems([item("a", ["p2"])], "p1")).toBe(0);
  });

  it("returns 0 for no items", () => {
    expect(countAssignedItems([], "p1")).toBe(0);
  });

  it("counts an item once even when several people share it", () => {
    expect(countAssignedItems([item("a", ["p1", "p2", "p3"])], "p1")).toBe(1);
  });
});
