import type { Canvas } from "fabric";

export interface ConfigureCanvasProps {
  fillColor: string;
  strokeWidth: number;
  strokeColor: string;
  displayRadius: number;
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
