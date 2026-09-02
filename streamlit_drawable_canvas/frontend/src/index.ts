// R2 SPIKE — temporary minimal probe for Fabric 7 pointer behaviour inside a
// shadow root (isolate_styles=True). Replaced by the real renderer once the
// spike is verified.
import { Canvas, PencilBrush } from "fabric";
import type { FrontendRenderer } from "@streamlit/component-v2-lib";

const SpikeRenderer: FrontendRenderer = (args) => {
  const { parentElement } = args;
  const canvasEl = (parentElement as ShadowRoot | HTMLElement).querySelector(
    "canvas"
  ) as HTMLCanvasElement;

  const canvas = new Canvas(canvasEl, { enableRetinaScaling: false });
  canvas.freeDrawingBrush = new PencilBrush(canvas);
  canvas.freeDrawingBrush.width = 5;
  canvas.freeDrawingBrush.color = "#ff0000";
  canvas.isDrawingMode = true;

  // Expose for the spike test harness to read back object geometry.
  const w = window as unknown as { __spikeCanvases: unknown[] };
  w.__spikeCanvases ??= [];
  w.__spikeCanvases.push({ host: parentElement, canvas, canvasEl });

  return () => {
    canvas.dispose();
  };
};

export default SpikeRenderer;
