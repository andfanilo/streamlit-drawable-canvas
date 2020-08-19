import { PythonArgs } from "../DrawableCanvas"
import FabricTool from "./fabrictool"

class FreedrawTool extends FabricTool {
  configureCanvas(args: PythonArgs): void {
    const { brushWidth, brushColor } = args
    this._canvas.isDrawingMode = true
    this._canvas.freeDrawingBrush.width = brushWidth
    this._canvas.freeDrawingBrush.color = brushColor
  }
}

export default FreedrawTool
