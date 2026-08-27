import { describe, expect, it } from "vitest";

import { nextTabIndex } from "./tablistNavigation";

describe("moving through a tab list", () => {
  it("walks right and wraps at the end", () => {
    expect(nextTabIndex(0, 4, "ArrowRight")).toBe(1);
    expect(nextTabIndex(3, 4, "ArrowRight")).toBe(0);
  });

  it("walks left and wraps at the start", () => {
    expect(nextTabIndex(2, 4, "ArrowLeft")).toBe(1);
    expect(nextTabIndex(0, 4, "ArrowLeft")).toBe(3);
  });

  it("jumps to either end", () => {
    expect(nextTabIndex(2, 4, "Home")).toBe(0);
    expect(nextTabIndex(1, 4, "End")).toBe(3);
  });

  it("leaves any other key alone", () => {
    // The caller only calls preventDefault when this says something, so a
    // Tab or a typed character has to come back as nothing.
    expect(nextTabIndex(1, 4, "Tab")).toBeNull();
    expect(nextTabIndex(1, 4, "a")).toBeNull();
    expect(nextTabIndex(1, 4, "Enter")).toBeNull();
  });

  it("has nowhere to go in an empty list", () => {
    expect(nextTabIndex(0, 0, "ArrowRight")).toBeNull();
  });
});
