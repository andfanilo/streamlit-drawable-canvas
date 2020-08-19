import { PythonArgs } from "../DrawableCanvas"
import FabricTool from "./fabrictool"

class LineTool extends FabricTool {
  configureCanvas(args: PythonArgs): void {
    this._canvas.isDrawingMode = false
    this._canvas.selection = false
    this._canvas.getObjects().forEach((obj) => obj.set("selectable", false))
  }
}

export default LineTool
