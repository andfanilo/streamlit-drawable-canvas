import { PythonArgs } from "../DrawableCanvas"
import FabricTool from "./fabrictool"

class TransformTool extends FabricTool {
  configureCanvas(args: PythonArgs): void {
    this._canvas.isDrawingMode = false
    this._canvas.selection = true
    this._canvas.getObjects().forEach((obj) => obj.set("selectable", true))
  }
}

export default TransformTool
