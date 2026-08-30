import { initialTip, Person, Tip } from "@/types";
import { PERSON_COLORS } from "./constants";

/** The tip question as answered on the setup step. */
export interface SetupTipAnswer {
  /** Whether the tip was already printed on the bill. */
  onBill: boolean;
  /** Percentage to add, meaningful only when the tip was NOT on the bill. */
  percent: number;
}

/**
 * Turn the names typed on the setup step into people.
 *
 * Blank rows are dropped rather than becoming nameless people: Continue is
 * deliberately allowed with empty rows, so they are a normal input, not an error.
 */
export function buildInitialPeople(names: string[]): Person[] {
  return names
    .map((name) => name.trim())
    .filter((name) => name.length > 0)
    .map((name, index) => ({
      id: `person-${Date.now()}-${index}-${Math.random()
        .toString(36)
        .slice(2, 6)}`,
      name,
      // Cycles so a group larger than the palette still gets distinct-looking
      // neighbours, matching how the receipt page assigns colors.
      color: PERSON_COLORS[index % PERSON_COLORS.length],
    }));
}

/**
 * Decide the receipt's starting tip from the answer and the bill.
 *
 * The question is required, so both answers are deliberate and neither needs to
 * defer to the other. An earlier design made the answer optional, which forced
 * an asymmetry — a default state must not silently discard a printed tip. With
 * an explicit answer that reasoning no longer applies.
 *
 * | answer          | bill    | result          |
 * | --------------- | ------- | --------------- |
 * | on the bill     | printed | the printed tip |
 * | on the bill     | none    | no tip          |
 * | not on the bill | either  | the percentage  |
 */
export function resolveInitialTip(
  answer: SetupTipAnswer,
  parsedTipCents: number | null
): Tip {
  if (!answer.onBill) {
    return { cents: 0, isPercent: true, percent: answer.percent };
  }

  // Said to be on the bill. If the scan missed it, no tip is better than an
  // invented one — the TIP row stays editable on the receipt page. `percent`
  // keeps the default so a later toggle to % still offers a suggestion.
  return {
    cents: parsedTipCents ?? 0,
    isPercent: false,
    percent: initialTip.percent,
  };
}
