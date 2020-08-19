import { PythonArgs } from "../DrawableCanvas"
import FabricTool from "./fabrictool"

class TransformTool extends FabricTool {
  configureCanvas(args: PythonArgs): void {
    this._canvas.isDrawingMode = false
    this._canvas.selection = true
    this._canvas.forEachObject((o) => (o.selectable = o.evented = true))
  }
}

export default TransformTool
