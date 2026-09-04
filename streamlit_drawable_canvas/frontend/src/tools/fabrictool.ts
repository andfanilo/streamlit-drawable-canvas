import type { Canvas, Control, FabricObject } from "fabric";

export interface PointEditSnapshot {
  controls: Record<string, Control>;
  hasBorders: boolean;
  cornerStyle: string;
  cornerColor?: string;
  cornerStrokeColor?: string;
  transparentCorners: boolean;
  cornerSize: number;
  touchCornerSize: number;
}

export interface PointEditState {
  object: FabricObject;
  saved: PointEditSnapshot;
}

export interface PointEditController {
  get(): PointEditState | null;
  set(state: PointEditState | null): void;
}

export interface ConfigureCanvasProps {
  fillColor: string;
  strokeWidth: number;
  strokeColor: string;
  displayRadius: number;
  fontSize: number;
  /** Text-only: anchor for IText's hidden textarea. Must be inside the
   *  shadow root (so it can take focus/input) but outside `.dc-scroll` and
   *  zero-sized (so Fabric's page-absolute positioning math -- which double-
   *  counts the canvas's own offset once reparented off `doc.body` -- can't
   *  inflate the scroll container or drag the canvas out of view). */
  hiddenTextareaContainer: HTMLElement;
  /** Polygon-only: called once the shape is closed, so the caller can force
   *  a send regardless of update_streamlit. */
  onPolygonClosed: () => void;
  pointEdit: PointEditController;
  pointEditCornerColor: string;
  pointEditCornerStrokeColor: string;
}

/**
 * Base class for any fabric tool that configures and draws on canvas
 */
export abstract class FabricTool {
  protected canvas: Canvas;

  /**
   * Pass Fabric canvas by reference so tools can configure it
   */
  constructor(canvas: Canvas) {
    this.canvas = canvas;
  }

  /**
   * Configure canvas and return a callback to clean up event listeners
   */
  abstract configureCanvas(args: ConfigureCanvasProps): () => void;
}
