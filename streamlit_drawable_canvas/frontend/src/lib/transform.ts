import FabricTool, { ConfigureCanvasProps } from "./fabrictool"

class TransformTool extends FabricTool {
  configureCanvas(args: ConfigureCanvasProps): () => void {
    let canvas = this._canvas
    canvas.isDrawingMode = false
    canvas.selection = true
    canvas.forEachObject((o) => (o.selectable = o.evented = true))

    // instead of looking for target of double click,
    // assume double click on object clears the selected object
    const handleDoubleClick = () => {
      canvas.remove(canvas.getActiveObject())
    }

    canvas.on("mouse:dblclick", handleDoubleClick)
    return () => {
      canvas.off("mouse:dblclick", handleDoubleClick)
    }
  }
}

export default TransformTool
