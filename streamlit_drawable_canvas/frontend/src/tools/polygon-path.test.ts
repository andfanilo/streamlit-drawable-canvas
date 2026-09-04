import { describe, expect, it } from "vitest";
import { buildPathString } from "./polygon-path";

describe("buildPathString", () => {
  it("returns a degenerate path for no points", () => {
    expect(buildPathString([], false)).toBe("M 0 0");
  });

  it("renders a single point as a bare moveto", () => {
    expect(buildPathString([{ x: 1, y: 2 }], false)).toBe("M 1 2");
  });

  it("renders each subsequent point as a lineto, open by default", () => {
    expect(
      buildPathString(
        [
          { x: 0, y: 0 },
          { x: 10, y: 0 },
          { x: 10, y: 10 },
        ],
        false
      )
    ).toBe("M 0 0 L 10 0 L 10 10");
  });

  it("appends z when closed", () => {
    expect(
      buildPathString(
        [
          { x: 0, y: 0 },
          { x: 10, y: 0 },
          { x: 10, y: 10 },
        ],
        true
      )
    ).toBe("M 0 0 L 10 0 L 10 10 z");
  });

  it("re-derives correctly after removing a middle vertex", () => {
    const points = [
      { x: 0, y: 0 },
      { x: 5, y: 5 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
    ];
    const withoutMiddle = [...points.slice(0, 1), ...points.slice(2)];
    expect(buildPathString(withoutMiddle, false)).toBe("M 0 0 L 10 0 L 10 10");
  });
});
