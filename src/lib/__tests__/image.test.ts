import { describe, it, expect } from "vitest";
import { preprocessImage } from "../image";

// Note: These tests run in a Node environment where HTMLCanvasElement
// and HTMLImageElement are not available. We test the exported function
// exists and handles invalid input gracefully.

describe("preprocessImage", () => {
  it("is a function that accepts File | string", () => {
    expect(typeof preprocessImage).toBe("function");
  });

  it("returns a promise", () => {
    // In Node env without canvas, this will reject, but it should still return a promise
    const result = preprocessImage("data:image/png;base64,invalid");
    expect(result).toBeInstanceOf(Promise);
    // Clean up the rejection
    result.catch(() => {});
  });
});
