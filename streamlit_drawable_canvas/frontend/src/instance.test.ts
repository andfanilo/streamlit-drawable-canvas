import { describe, expect, it } from "vitest";
import { DrawableCanvasData, isToolbarVisible, toolKeyFor } from "./instance";

const baseData: DrawableCanvasData = {
  fillColor: "#eee",
  strokeWidth: 20,
  strokeColor: "black",
  backgroundColor: "",
  backgroundImageURL: null,
  realtimeUpdateStreamlit: true,
  canvasWidth: 600,
  canvasHeight: 400,
  drawingMode: "freedraw",
  initialDrawing: { objects: [] },
  displayRadius: 3,
  returnImageData: false,
  disabled: false,
  backgroundImageFit: "stretch",
  maxDisplayHeight: null,
  fontSize: 20,
  label: "",
};

describe("isToolbarVisible", () => {
  it("is visible by default", () => {
    expect(isToolbarVisible(baseData)).toBe(true);
  });

  it("is hidden when disabled, with no other flag involved", () => {
    expect(isToolbarVisible({ ...baseData, disabled: true })).toBe(false);
  });
});

describe("toolKeyFor", () => {
  it("is stable across calls with equivalent tool-affecting fields", () => {
    expect(toolKeyFor(baseData, false)).toBe(
      toolKeyFor({ ...baseData }, false)
    );
  });

  it("changes when drawingMode changes", () => {
    expect(toolKeyFor(baseData, false)).not.toBe(
      toolKeyFor({ ...baseData, drawingMode: "rect" }, false)
    );
  });

  it("changes when editActive changes", () => {
    expect(toolKeyFor(baseData, false)).not.toBe(toolKeyFor(baseData, true));
  });

  it("changes when disabled is toggled", () => {
    expect(toolKeyFor({ ...baseData, disabled: true }, false)).not.toBe(
      toolKeyFor(baseData, false)
    );
  });

  it("changes when fillColor, strokeWidth, strokeColor, displayRadius, fontSize, or label change", () => {
    const base = toolKeyFor(baseData, false);
    expect(toolKeyFor({ ...baseData, fillColor: "#fff" }, false)).not.toBe(
      base
    );
    expect(toolKeyFor({ ...baseData, strokeWidth: 5 }, false)).not.toBe(base);
    expect(toolKeyFor({ ...baseData, strokeColor: "red" }, false)).not.toBe(
      base
    );
    expect(toolKeyFor({ ...baseData, displayRadius: 10 }, false)).not.toBe(
      base
    );
    expect(toolKeyFor({ ...baseData, fontSize: 30 }, false)).not.toBe(base);
    expect(toolKeyFor({ ...baseData, label: "person" }, false)).not.toBe(base);
  });

  it("ignores fields that don't affect tool configuration", () => {
    const base = toolKeyFor(baseData, false);
    expect(
      toolKeyFor(
        {
          ...baseData,
          canvasWidth: 999,
          canvasHeight: 999,
          backgroundColor: "#000",
          backgroundImageURL: "https://example.com/x.png",
          realtimeUpdateStreamlit: false,
          initialDrawing: { objects: [{ type: "rect" }] },
          returnImageData: true,
          backgroundImageFit: "contain",
          maxDisplayHeight: 300,
        },
        false
      )
    ).toBe(base);
  });
});
