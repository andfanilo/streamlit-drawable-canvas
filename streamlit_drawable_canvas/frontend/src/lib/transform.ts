import { PythonArgs, sendDataToStreamlit } from "../DrawableCanvas"
import FabricTool from "./fabrictool"

class TransformTool extends FabricTool {
  configureCanvas(args: PythonArgs): () => void {
    let canvas = this._canvas
    canvas.isDrawingMode = false
    canvas.selection = true
    canvas.forEachObject((o) => (o.selectable = o.evented = true))

    canvas.on("mouse:dblclick", () => {
      canvas.remove(canvas.getActiveObject())
      sendDataToStreamlit(canvas)
    })
    return () => {
      canvas.off("mouse:dblclick")
    }
  }
}

export default TransformTool
