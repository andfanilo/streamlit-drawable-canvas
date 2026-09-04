import { describe, expect, it } from "vitest";
import {
  chipFlipsInside,
  chipHeight,
  contrastTextColor,
} from "./labeled-geometry";

describe("chipHeight", () => {
  it("is fontSize plus top and bottom padding", () => {
    expect(chipHeight(20, 4)).toBe(28);
    expect(chipHeight(12, 2)).toBe(16);
    expect(chipHeight(40, 6)).toBe(52);
  });

  it("is zero-padding-safe", () => {
    expect(chipHeight(20, 0)).toBe(20);
  });
});

describe("chipFlipsInside", () => {
  it("does not flip when there is room above the box", () => {
    expect(chipFlipsInside(100, 28, 4)).toBe(false);
  });

  it("flips when the chip's top would clip above the canvas", () => {
    expect(chipFlipsInside(20, 28, 4)).toBe(true);
  });

  it("does not flip exactly at the boundary (top edge lands on 0)", () => {
    expect(chipFlipsInside(32, 28, 4)).toBe(false);
  });

  it("flips just past the boundary", () => {
    expect(chipFlipsInside(31.999, 28, 4)).toBe(true);
  });
});

describe("contrastTextColor", () => {
  it("picks black text on white", () => {
    expect(contrastTextColor([255, 255, 255])).toBe("#000");
  });

  it("picks white text on black", () => {
    expect(contrastTextColor([0, 0, 0])).toBe("#fff");
  });

  it("picks white just below the 0.5 luminance threshold", () => {
    expect(contrastTextColor([127, 127, 127])).toBe("#fff");
  });

  it("picks black just above the 0.5 luminance threshold", () => {
    expect(contrastTextColor([128, 128, 128])).toBe("#000");
  });

  it("weights green heaviest: saturated green reads as light", () => {
    expect(contrastTextColor([0, 255, 0])).toBe("#000");
  });

  it("weights blue lightest: saturated blue reads as dark", () => {
    expect(contrastTextColor([0, 0, 255])).toBe("#fff");
  });
});
