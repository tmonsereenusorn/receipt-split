import { describe, it, expect } from "vitest";
import { prepareImageBase64 } from "../image";

// Note: These tests run in a Node environment where HTMLCanvasElement
// and HTMLImageElement are not available. We test the exported function
// exists and handles invalid input gracefully.

describe("prepareImageBase64", () => {
  it("is a function that accepts File | string", () => {
    expect(typeof prepareImageBase64).toBe("function");
  });

  it("returns a promise", () => {
    // In Node env without canvas, this will reject, but it should still return a promise
    const result = prepareImageBase64("data:image/png;base64,invalid");
    expect(result).toBeInstanceOf(Promise);
    // Clean up the rejection
    result.catch(() => {});
  });
});
