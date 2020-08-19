import { PythonArgs } from "../DrawableCanvas"
import { fabric } from "fabric"

/**
 * Base class for any fabric tool that configures and draws on canvas
 */
abstract class FabricTool {
  protected _canvas: fabric.Canvas

  constructor(canvas: fabric.Canvas) {
    // Pass Fabric canvas by reference
    // so tools can configure it
    this._canvas = canvas
  }

  abstract configureCanvas(args: PythonArgs): void
}

export default FabricTool
