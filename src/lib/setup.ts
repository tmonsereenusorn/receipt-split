import { initialTip, Person, Tip } from "@/types";
import { PERSON_COLORS } from "./constants";

/** The tip question as answered on the setup step. */
export interface SetupTipAnswer {
  /** Whether the user said a tip is being added that isn't on the bill. */
  enabled: boolean;
  /** Percentage to apply, meaningful only when `enabled`. */
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
 * Decide the receipt's starting tip from the setup answer and the bill.
 *
 * Two sources can supply one, and the user answers before the scan result
 * exists, so they can disagree. **An active choice overrides the bill; inaction
 * does not.** Unchecked is the default state, so treating it as a deliberate
 * "no tip" would let someone discard a tip actually printed on the receipt
 * merely by pressing Continue without reading.
 *
 * | answer    | bill    | result        |
 * | --------- | ------- | ------------- |
 * | checked   | printed | the percentage |
 * | checked   | none    | the percentage |
 * | unchecked | printed | the printed tip |
 * | unchecked | none    | no tip         |
 */
export function resolveInitialTip(
  answer: SetupTipAnswer,
  parsedTipCents: number | null
): Tip {
  if (answer.enabled) {
    return { cents: 0, isPercent: true, percent: answer.percent };
  }

  if (parsedTipCents !== null) {
    return {
      cents: parsedTipCents,
      isPercent: false,
      percent: initialTip.percent,
    };
  }

  // No tip. `percent` keeps the default so switching the row to % later still
  // offers a suggestion rather than 0%.
  return { cents: 0, isPercent: false, percent: initialTip.percent };
}
