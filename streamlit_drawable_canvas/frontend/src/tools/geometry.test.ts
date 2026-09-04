import { describe, expect, it } from "vitest";
import {
  applyMatrix2,
  boxCorners,
  distance,
  pathCommandsToPoints,
  removeVertex,
} from "./geometry";

describe("pathCommandsToPoints", () => {
  it("converts a closed M/L/z path to points", () => {
    const path = [["M", 10, 10], ["L", 90, 20], ["L", 50, 80], ["z"]];
    expect(pathCommandsToPoints(path)).toEqual([
      { x: 10, y: 10 },
      { x: 90, y: 20 },
      { x: 50, y: 80 },
    ]);
  });

  it("is case-insensitive on commands", () => {
    const path = [["m", 10, 10], ["l", 90, 20], ["l", 50, 80], ["Z"]];
    expect(pathCommandsToPoints(path)).toEqual([
      { x: 10, y: 10 },
      { x: 90, y: 20 },
      { x: 50, y: 80 },
    ]);
  });

  it("returns null for an open M/L path", () => {
    const path = [
      ["M", 10, 10],
      ["L", 90, 20],
      ["L", 50, 80],
    ];
    expect(pathCommandsToPoints(path)).toBeNull();
  });

  it("returns null when any command is a curve (Q/C)", () => {
    const withQ = [["M", 10, 10], ["Q", 50, 0, 90, 10], ["L", 50, 80], ["z"]];
    const withC = [
      ["M", 10, 10],
      ["C", 20, 0, 60, 0, 90, 10],
      ["L", 50, 80],
      ["z"],
    ];
    expect(pathCommandsToPoints(withQ)).toBeNull();
    expect(pathCommandsToPoints(withC)).toBeNull();
  });

  it("returns null for a closed path with fewer than 3 vertices", () => {
    const path = [["M", 10, 10], ["L", 90, 20], ["z"]];
    expect(pathCommandsToPoints(path)).toBeNull();
  });
});

describe("applyMatrix2", () => {
  const points = [
    { x: 1, y: 0 },
    { x: 0, y: 1 },
  ];

  it("identity leaves points unchanged", () => {
    expect(applyMatrix2(points, [1, 0, 0, 1])).toEqual(points);
  });

  it("applies a pure scale", () => {
    expect(applyMatrix2(points, [2, 0, 0, 3])).toEqual([
      { x: 2, y: 0 },
      { x: 0, y: 3 },
    ]);
  });

  it("applies a pure skew", () => {
    // skewX-only matrix: x' = x + tan(skew) * y, y' = y
    expect(applyMatrix2(points, [1, 0, 0.5, 1])).toEqual([
      { x: 1, y: 0 },
      { x: 0.5, y: 1 },
    ]);
  });

  it("applies a scale+skew composite", () => {
    expect(applyMatrix2(points, [2, 0.5, 0.5, 3])).toEqual([
      { x: 2, y: 0.5 },
      { x: 0.5, y: 3 },
    ]);
  });
});

describe("boxCorners", () => {
  it("returns tl, tr, br, bl in that order, centred on the origin", () => {
    expect(boxCorners(100, 80)).toEqual([
      { x: -50, y: -40 },
      { x: 50, y: -40 },
      { x: 50, y: 40 },
      { x: -50, y: 40 },
    ]);
  });
});

describe("removeVertex", () => {
  const square = [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 10, y: 10 },
    { x: 0, y: 10 },
  ];

  it("removes the vertex at the given index", () => {
    expect(removeVertex(square, 1)).toEqual([
      { x: 0, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ]);
  });

  it("returns null at the 3-vertex floor", () => {
    const triangle = square.slice(0, 3);
    expect(removeVertex(triangle, 0)).toBeNull();
  });
});

describe("distance", () => {
  it("computes euclidean distance", () => {
    expect(distance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
  });
});

describe("boxCorners -> applyMatrix2(identity) round-trip", () => {
  it("leaves corners unchanged", () => {
    const corners = boxCorners(60, 40);
    expect(applyMatrix2(corners, [1, 0, 0, 1])).toEqual(corners);
  });
});
