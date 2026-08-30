import { describe, it, expect } from "vitest";
import { interpretExtraction } from "../receiptExtraction";

const VALID = JSON.stringify({
  restaurantName: "The Garden Bistro",
  items: [{ name: "Latte", quantity: 1, lineTotalCents: 450 }],
  charges: [{ label: "Tax", amountCents: 40 }],
  tipCents: null,
  currency: "USD",
});

describe("interpretExtraction", () => {
  it("returns parsed data for clean JSON", () => {
    const result = interpretExtraction("end_turn", VALID);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.restaurantName).toBe("The Garden Bistro");
    expect(result.data.items).toEqual([
      { name: "Latte", quantity: 1, priceCents: 450 },
    ]);
    expect(result.data.charges).toEqual([{ label: "Tax", amountCents: 40 }]);
    expect(result.data.currency).toBe("USD");
  });

  it("strips markdown fences before parsing", () => {
    const result = interpretExtraction("end_turn", "```json\n" + VALID + "\n```");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.items).toHaveLength(1);
  });

  it("accepts a receipt with no line items", () => {
    const result = interpretExtraction(
      "end_turn",
      '{"restaurantName":null,"items":[],"currency":"USD"}'
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.items).toEqual([]);
  });

  it("reports truncation when the model hit the output cap", () => {
    const result = interpretExtraction("max_tokens", VALID.slice(0, 78));

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("truncated");
  });

  it("reports truncation even if the partial output happens to parse", () => {
    // stop_reason is authoritative: incomplete output must never look like success,
    // or we would silently drop the items that got cut off.
    const result = interpretExtraction("max_tokens", VALID);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("truncated");
  });

  it("finds JSON wrapped in a fence with prose either side", () => {
    const result = interpretExtraction(
      "end_turn",
      "Here is the JSON:\n```JSON\n" + VALID + "\n```\nLet me know!"
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.items).toHaveLength(1);
    expect(result.data.charges).toEqual([{ label: "Tax", amountCents: 40 }]);
  });

  it("reports unreadable for a JSON object that is not a receipt", () => {
    const result = interpretExtraction(
      "end_turn",
      '{"error":"no receipt visible"}'
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("unreadable");
  });

  it("reports unreadable for a bare JSON array", () => {
    const result = interpretExtraction(
      "end_turn",
      '[{"name":"Latte","quantity":1,"priceCents":450}]'
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("unreadable");
  });

  it("reports partial rather than silently dropping invalid line items", () => {
    const result = interpretExtraction(
      "end_turn",
      JSON.stringify({
        items: [
          { name: "Latte", quantity: 1, priceCents: 450 },
          { name: "Toast", quantity: 1, priceCents: "1299" },
        ],
        currency: "USD",
      })
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("partial");
  });

  it("separates a refusal from an empty reply", () => {
    const refused = interpretExtraction("refusal", "");
    const empty = interpretExtraction("end_turn", "");

    expect(refused.ok).toBe(false);
    expect(empty.ok).toBe(false);
    if (refused.ok || empty.ok) return;
    expect(refused.code).toBe("refused");
    expect(empty.code).toBe("empty");
    expect(refused.message).not.toBe(empty.message);
  });

  it("reports an unreadable image when the model replies with prose", () => {
    const result = interpretExtraction(
      "end_turn",
      "I'm unable to read this image clearly enough to extract line items."
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("unreadable");
  });

  it("reports an unreadable image for a literal null response", () => {
    const result = interpretExtraction("end_turn", "null");

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("unreadable");
  });

  it("reports an empty response when the model returned no text", () => {
    const result = interpretExtraction("end_turn", "");

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("empty");
  });

  it("gives truncated and unreadable distinct user-facing messages", () => {
    const truncated = interpretExtraction("max_tokens", VALID.slice(0, 78));
    const unreadable = interpretExtraction("end_turn", "cannot read this");

    expect(truncated.ok).toBe(false);
    expect(unreadable.ok).toBe(false);
    if (truncated.ok || unreadable.ok) return;
    expect(truncated.message).not.toBe(unreadable.message);
    expect(truncated.message.length).toBeGreaterThan(0);
    expect(unreadable.message.length).toBeGreaterThan(0);
  });
});

describe("interpretExtraction charges", () => {
  it("parses charges with labels preserved verbatim", () => {
    const result = interpretExtraction(
      "end_turn",
      '{"items":[],"charges":[{"label":"Service Charge 18%","amountCents":1105}],"currency":"USD"}'
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.charges).toEqual([
      { label: "Service Charge 18%", amountCents: 1105 },
    ]);
  });

  it("keeps multiple charges in receipt order", () => {
    const result = interpretExtraction(
      "end_turn",
      '{"items":[],"charges":[{"label":"Tax","amountCents":537},{"label":"Bag Fee","amountCents":10}],"currency":"USD"}'
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.charges.map((c) => c.label)).toEqual(["Tax", "Bag Fee"]);
  });

  it("trims surrounding whitespace from a label", () => {
    const result = interpretExtraction(
      "end_turn",
      '{"items":[],"charges":[{"label":"  Tax  ","amountCents":537}],"currency":"USD"}'
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.charges[0].label).toBe("Tax");
  });

  it("rounds a fractional charge amount", () => {
    const result = interpretExtraction(
      "end_turn",
      '{"items":[],"charges":[{"label":"Tax","amountCents":536.8}],"currency":"USD"}'
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.charges[0].amountCents).toBe(537);
  });

  it("treats an absent charges key as no charges", () => {
    const result = interpretExtraction("end_turn", '{"items":[],"currency":"USD"}');

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.charges).toEqual([]);
  });

  it("treats a non-array charges value as no charges without throwing", () => {
    const result = interpretExtraction(
      "end_turn",
      '{"items":[],"charges":"none","currency":"USD"}'
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.charges).toEqual([]);
  });

  it("omits a zero-amount charge rather than storing a $0.00 row", () => {
    const result = interpretExtraction(
      "end_turn",
      '{"items":[],"charges":[{"label":"Tax","amountCents":0}],"currency":"USD"}'
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.charges).toEqual([]);
  });

  it("keeps the scan when a charge is malformed, dropping only that charge", () => {
    // `partial` is unrecoverable — the same photo reproduces it — so failing the
    // whole scan over one bad charge would make that receipt permanently
    // unscannable. A missing charge is visible and can be re-added by hand.
    const result = interpretExtraction(
      "end_turn",
      '{"items":[{"name":"Latte","quantity":1,"lineTotalCents":450}],"charges":[{"label":"Tax","amountCents":40},{"label":"Bad","amountCents":"five"}],"currency":"USD"}'
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.items).toHaveLength(1);
    expect(result.data.charges).toEqual([{ label: "Tax", amountCents: 40 }]);
  });

  it("drops a charge with no label but keeps the rest of the scan", () => {
    const result = interpretExtraction(
      "end_turn",
      '{"items":[],"charges":[{"amountCents":537},{"label":"Tax","amountCents":40}],"currency":"USD"}'
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.charges).toEqual([{ label: "Tax", amountCents: 40 }]);
  });

  it("keeps a negative charge, because a discount is a real receipt line", () => {
    // Dropping it would overstate the total — the wrong direction to be wrong in.
    const result = interpretExtraction(
      "end_turn",
      '{"items":[],"charges":[{"label":"Promo","amountCents":-500}],"currency":"USD"}'
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.charges).toEqual([{ label: "Promo", amountCents: -500 }]);
  });

  it("rejects an absurd charge magnitude in either direction", () => {
    const result = interpretExtraction(
      "end_turn",
      '{"items":[],"charges":[{"label":"Huge","amountCents":999999999999},{"label":"Tax","amountCents":40}],"currency":"USD"}'
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.charges).toEqual([{ label: "Tax", amountCents: 40 }]);
  });

  it("still fails as partial when an ITEM is unusable", () => {
    const result = interpretExtraction(
      "end_turn",
      '{"items":[{"name":"Latte","quantity":1,"lineTotalCents":450},{"name":"Bad"}],"charges":[],"currency":"USD"}'
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("partial");
  });
});

describe("line total to unit price", () => {
  const reply = (items: string) =>
    `{"items":[${items}],"charges":[],"currency":"USD"}`;

  it("divides the printed line total by the quantity", () => {
    // The model transcribes what is printed; the arithmetic is done here, where
    // it is exact. Asking a model to divide is asking it to do the one thing it
    // is worst at, on the number that decides what people pay.
    const result = interpretExtraction(
      "end_turn",
      reply('{"name":"Craft Beer","quantity":2,"lineTotalCents":1200}')
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.items[0]).toEqual({
      name: "Craft Beer",
      quantity: 2,
      priceCents: 600,
    });
  });

  it("rounds to the nearest cent when the total does not divide evenly", () => {
    const result = interpretExtraction(
      "end_turn",
      reply('{"name":"Fish Taco","quantity":3,"lineTotalCents":1000}')
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.items[0].priceCents).toBe(333);
  });

  it("leaves a single-quantity line alone", () => {
    const result = interpretExtraction(
      "end_turn",
      reply('{"name":"House Salad","quantity":1,"lineTotalCents":925}')
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.items[0].priceCents).toBe(925);
  });

  it("handles a free item", () => {
    const result = interpretExtraction(
      "end_turn",
      reply('{"name":"Comped Dessert","quantity":2,"lineTotalCents":0}')
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.items[0].priceCents).toBe(0);
  });

  it("drops a line with no usable quantity rather than dividing by zero", () => {
    const result = interpretExtraction(
      "end_turn",
      reply('{"name":"Bad","quantity":0,"lineTotalCents":500},{"name":"Good","quantity":1,"lineTotalCents":100}')
    );

    // A dropped item still makes the scan partial — unlike a charge, a missing
    // dish cannot be split.
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("partial");
  });

  it("drops a line with a negative total", () => {
    const result = interpretExtraction(
      "end_turn",
      reply('{"name":"Bad","quantity":1,"lineTotalCents":-500}')
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("partial");
  });
});

describe("fractional quantities", () => {
  const reply = (items: string) =>
    `{"items":[${items}],"charges":[],"currency":"USD"}`;

  it("keeps a weighed line rather than losing it", () => {
    // "0.4 kg Bulk Coffee $6.00" is an ordinary receipt line. It used to pass
    // the quantity > 0 filter, round to 0, divide by zero, and become Infinity —
    // which JSON.stringify turns into null, which the storage boundary then
    // rejects on read. The item vanished from the bill with no error anywhere.
    const result = interpretExtraction(
      "end_turn",
      reply('{"name":"Bulk Coffee","quantity":0.4,"lineTotalCents":600}')
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.items).toEqual([
      { name: "Bulk Coffee", quantity: 1, priceCents: 600 },
    ]);
  });

  it("preserves the line total for any fractional quantity", () => {
    // The receipt says the line cost $6.00; whatever we do to quantity, the
    // line must still cost $6.00.
    for (const quantity of [0.1, 0.4, 0.5, 0.9, 1.4]) {
      const result = interpretExtraction(
        "end_turn",
        reply(`{"name":"Bulk","quantity":${quantity},"lineTotalCents":600}`)
      );

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const item = result.data.items[0];
      expect(item.quantity * item.priceCents).toBe(600);
    }
  });

  it("never produces a non-finite price", () => {
    const result = interpretExtraction(
      "end_turn",
      reply('{"name":"A","quantity":0.4,"lineTotalCents":600},{"name":"B","quantity":2,"lineTotalCents":1000}')
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    for (const item of result.data.items) {
      expect(Number.isFinite(item.priceCents)).toBe(true);
      expect(Number.isFinite(item.quantity)).toBe(true);
    }
  });

  it("still drops a line with a genuinely unusable quantity", () => {
    const result = interpretExtraction(
      "end_turn",
      reply('{"name":"Bad","quantity":"two","lineTotalCents":600}')
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("partial");
  });
});

describe("unit price vs line total, reconciled against the printed total", () => {
  const reply = (items: string, extra = "") =>
    `{"items":[${items}],"charges":[],"currency":"USD"${extra}}`;

  it("reads the amount as a unit price when that is what reconciles", () => {
    // "2 BEER 6.00 / 3 TACO 4.50 / 1 SALAD 9.25, TOTAL 34.75". Read as line
    // totals the receipt sums to 19.75, so the printed amounts must be per
    // unit. The model transcribes; this decides, because it is arithmetic.
    const result = interpretExtraction(
      "end_turn",
      reply(
        '{"name":"Beer","quantity":2,"lineTotalCents":600},' +
          '{"name":"Taco","quantity":3,"lineTotalCents":450},' +
          '{"name":"Salad","quantity":1,"lineTotalCents":925}',
        ',"itemsTotalCents":3475'
      )
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.items.map((i) => i.priceCents)).toEqual([600, 450, 925]);
  });

  it("reads the amount as a line total when that is what reconciles", () => {
    // Same shape, but the printed total says the amounts are line totals.
    const result = interpretExtraction(
      "end_turn",
      reply(
        '{"name":"Beer","quantity":2,"lineTotalCents":1200},' +
          '{"name":"Taco","quantity":3,"lineTotalCents":1350}',
        ',"itemsTotalCents":2550'
      )
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.items.map((i) => i.priceCents)).toEqual([600, 450]);
  });

  it("treats the amount as a line total when no total is printed", () => {
    const result = interpretExtraction(
      "end_turn",
      reply('{"name":"Beer","quantity":2,"lineTotalCents":1200}')
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.items[0].priceCents).toBe(600);
  });

  it("is unaffected when every line is a single unit", () => {
    // Both readings are identical at quantity 1, so the total cannot and need
    // not distinguish them.
    const result = interpretExtraction(
      "end_turn",
      reply('{"name":"Salad","quantity":1,"lineTotalCents":925}', ',"itemsTotalCents":925')
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.items[0].priceCents).toBe(925);
  });

  it("keeps the line-total reading when the printed total matches neither", () => {
    // A misread total must not flip prices; ambiguity falls back to the
    // documented default rather than guessing.
    const result = interpretExtraction(
      "end_turn",
      reply('{"name":"Beer","quantity":2,"lineTotalCents":1200}', ',"itemsTotalCents":9999')
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.items[0].priceCents).toBe(600);
  });
});
