import { describe, expect, it } from "vitest";
import { DrawableCanvasData, toolKeyFor } from "./instance";

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
  displayToolbar: true,
  displayRadius: 3,
  returnImageData: false,
};

describe("toolKeyFor", () => {
  it("is stable across calls with equivalent tool-affecting fields", () => {
    expect(toolKeyFor(baseData)).toBe(toolKeyFor({ ...baseData }));
  });

  it("changes when drawingMode changes", () => {
    expect(toolKeyFor(baseData)).not.toBe(
      toolKeyFor({ ...baseData, drawingMode: "rect" })
    );
  });

  it("changes when fillColor, strokeWidth, strokeColor, or displayRadius change", () => {
    const base = toolKeyFor(baseData);
    expect(toolKeyFor({ ...baseData, fillColor: "#fff" })).not.toBe(base);
    expect(toolKeyFor({ ...baseData, strokeWidth: 5 })).not.toBe(base);
    expect(toolKeyFor({ ...baseData, strokeColor: "red" })).not.toBe(base);
    expect(toolKeyFor({ ...baseData, displayRadius: 10 })).not.toBe(base);
  });

  it("ignores fields that don't affect tool configuration", () => {
    const base = toolKeyFor(baseData);
    expect(
      toolKeyFor({
        ...baseData,
        canvasWidth: 999,
        canvasHeight: 999,
        backgroundColor: "#000",
        backgroundImageURL: "https://example.com/x.png",
        realtimeUpdateStreamlit: false,
        initialDrawing: { objects: [{ type: "rect" }] },
        displayToolbar: false,
        returnImageData: true,
      })
    ).toBe(base);
  });
});
