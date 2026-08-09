import { describe, it, expect } from "vitest";
import { interpretExtraction } from "../receiptExtraction";

const VALID = JSON.stringify({
  restaurantName: "The Garden Bistro",
  items: [{ name: "Latte", quantity: 1, priceCents: 450 }],
  taxCents: 40,
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
    expect(result.data.taxCents).toBe(40);
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
    expect(result.data.taxCents).toBe(40);
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

describe("interpretExtraction service charge", () => {
  it("parses a service charge", () => {
    const result = interpretExtraction(
      "end_turn",
      '{"items":[],"serviceChargeCents":2567,"currency":"USD"}'
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.serviceChargeCents).toBe(2567);
  });

  it("rounds a fractional service charge", () => {
    const result = interpretExtraction(
      "end_turn",
      '{"items":[],"serviceChargeCents":2566.8,"currency":"USD"}'
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.serviceChargeCents).toBe(2567);
  });

  it("treats an absent service charge as null", () => {
    const result = interpretExtraction("end_turn", '{"items":[],"currency":"USD"}');

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.serviceChargeCents).toBeNull();
  });

  it("treats a negative service charge as null", () => {
    const result = interpretExtraction(
      "end_turn",
      '{"items":[],"serviceChargeCents":-500,"currency":"USD"}'
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.serviceChargeCents).toBeNull();
  });

  it("treats a non-numeric service charge as null", () => {
    const result = interpretExtraction(
      "end_turn",
      '{"items":[],"serviceChargeCents":"18%","currency":"USD"}'
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.serviceChargeCents).toBeNull();
  });

  it("captures a service charge alongside items and tax", () => {
    const result = interpretExtraction(
      "end_turn",
      '{"restaurantName":"Cafe","items":[{"name":"Latte","quantity":1,"priceCents":450}],' +
        '"taxCents":40,"serviceChargeCents":81,"currency":"USD"}'
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.items).toHaveLength(1);
    expect(result.data.taxCents).toBe(40);
    expect(result.data.serviceChargeCents).toBe(81);
  });
});
