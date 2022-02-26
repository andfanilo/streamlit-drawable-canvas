import { fabric } from "fabric"

export interface ConfigureCanvasProps {
    fillColor: string
    strokeWidth: number
    strokeColor: string
    displayRadius: number
}

/**
 * Base class for any fabric tool that configures and draws on canvas
 */
abstract class FabricTool {
  protected _canvas: fabric.Canvas

  /**
   * Pass Fabric canvas by reference so tools can configure it
   */
  constructor(canvas: fabric.Canvas) {
    this._canvas = canvas
  }

  /**
   * Configure canvas and return a callback to clean eventListeners
   * @param args
   */
  abstract configureCanvas(args: ConfigureCanvasProps): () => void
}

export default FabricTool
