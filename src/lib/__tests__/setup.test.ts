import { describe, it, expect } from "vitest";
import { buildInitialPeople, resolveInitialTip } from "../setup";
import { initialTip } from "@/types";
import { PERSON_COLORS } from "../constants";

describe("buildInitialPeople", () => {
  it("returns no people for no names", () => {
    expect(buildInitialPeople([])).toEqual([]);
  });

  it("drops blank and whitespace-only names", () => {
    // Continue is allowed with empty rows, so they must not become people with
    // no name.
    const people = buildInitialPeople(["Alice", "", "   ", "Bob"]);

    expect(people.map((p) => p.name)).toEqual(["Alice", "Bob"]);
  });

  it("trims surrounding whitespace", () => {
    expect(buildInitialPeople(["  Alice  "])[0].name).toBe("Alice");
  });

  it("gives every person a distinct id", () => {
    const people = buildInitialPeople(["Alice", "Bob", "Cara"]);

    expect(new Set(people.map((p) => p.id)).size).toBe(3);
  });

  it("allows two people with the same name", () => {
    // Two Alexes at one dinner is ordinary; they are still separate people.
    const people = buildInitialPeople(["Alex", "Alex"]);

    expect(people).toHaveLength(2);
    expect(people[0].id).not.toBe(people[1].id);
  });

  it("assigns colors from the palette in order", () => {
    const people = buildInitialPeople(["a", "b"]);

    expect(people[0].color).toBe(PERSON_COLORS[0]);
    expect(people[1].color).toBe(PERSON_COLORS[1]);
  });

  it("cycles colors for a group larger than the palette", () => {
    const names = Array.from(
      { length: PERSON_COLORS.length + 1 },
      (_, i) => `p${i}`
    );

    const people = buildInitialPeople(names);

    expect(people[PERSON_COLORS.length].color).toBe(people[0].color);
  });
});

describe("resolveInitialTip", () => {
  it("uses the percentage when checked and the bill has no tip", () => {
    const tip = resolveInitialTip({ enabled: true, percent: 20 }, null);

    expect(tip).toEqual({ cents: 0, isPercent: true, percent: 20 });
  });

  it("overrides a printed tip when the box is checked", () => {
    // Checking the box is an active choice and beats the bill.
    const tip = resolveInitialTip({ enabled: true, percent: 20 }, 1200);

    expect(tip).toEqual({ cents: 0, isPercent: true, percent: 20 });
  });

  it("keeps a printed tip when the box is left unchecked", () => {
    // Unchecked is the default state, not a decision — it must not discard a
    // tip actually printed on the receipt.
    const tip = resolveInitialTip({ enabled: false, percent: 20 }, 1200);

    expect(tip).toEqual({
      cents: 1200,
      isPercent: false,
      percent: initialTip.percent,
    });
  });

  it("yields no tip when unchecked and the bill has none", () => {
    // Replaces the silent 20% every receipt used to carry.
    const tip = resolveInitialTip({ enabled: false, percent: 20 }, null);

    expect(tip.isPercent).toBe(false);
    expect(tip.cents).toBe(0);
  });

  it("treats a printed zero tip as printed, not absent", () => {
    // A receipt with a struck-through or written-in $0.00 tip line said
    // something; it is not the same as having no tip line at all.
    const tip = resolveInitialTip({ enabled: false, percent: 20 }, 0);

    expect(tip).toEqual({
      cents: 0,
      isPercent: false,
      percent: initialTip.percent,
    });
  });

  it("offers the default percentage for a later toggle when there is no tip", () => {
    const tip = resolveInitialTip({ enabled: false, percent: 20 }, null);

    expect(tip.percent).toBe(initialTip.percent);
  });
});

describe("tip percentages that scale everyone's total", () => {
  it("applies a fractional percentage exactly", () => {
    // The setup field commits a parsed float on blur; a decimal must survive
    // into the tip. Typing 12.5 previously landed on 5.
    const tip = resolveInitialTip({ enabled: true, percent: 12.5 }, null);

    expect(tip.percent).toBe(12.5);
    expect(tip.isPercent).toBe(true);
  });

  it("carries a zero percentage through as an explicit zero tip", () => {
    const tip = resolveInitialTip({ enabled: true, percent: 0 }, null);

    expect(tip.isPercent).toBe(true);
    expect(tip.percent).toBe(0);
  });
});
