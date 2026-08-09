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
