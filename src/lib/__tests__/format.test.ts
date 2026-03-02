import { describe, it, expect } from "vitest";
import { timeAgo } from "../format";

describe("timeAgo", () => {
  it("returns 'just now' for timestamps less than 60s ago", () => {
    expect(timeAgo(Date.now() - 30_000)).toBe("just now");
  });

  it("returns minutes ago", () => {
    expect(timeAgo(Date.now() - 5 * 60_000)).toBe("5m ago");
  });

  it("returns hours ago", () => {
    expect(timeAgo(Date.now() - 3 * 3_600_000)).toBe("3h ago");
  });

  it("returns days ago", () => {
    expect(timeAgo(Date.now() - 2 * 86_400_000)).toBe("2d ago");
  });

  it("returns '1m ago' at exactly 60 seconds", () => {
    expect(timeAgo(Date.now() - 60_000)).toBe("1m ago");
  });
});
