import { PythonArgs } from "../DrawableCanvas"
import FabricTool from "./fabrictool"

class FreedrawTool extends FabricTool {
  configureCanvas(args: PythonArgs): () => void {
    const { strokeWidth, strokeColor } = args
    this._canvas.isDrawingMode = true
    this._canvas.freeDrawingBrush.width = strokeWidth
    this._canvas.freeDrawingBrush.color = strokeColor
    return () => {}
  }
}

export default FreedrawTool
