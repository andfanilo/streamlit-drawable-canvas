import FabricTool, { ConfigureCanvasProps } from "./fabrictool"

class TransformTool extends FabricTool {
  configureCanvas(args: ConfigureCanvasProps): () => void {
    let canvas = this._canvas
    canvas.isDrawingMode = false
    canvas.selection = true
    canvas.forEachObject((o) => (o.selectable = o.evented = o.lockMovementX = o.lockMovementY =true))
    canvas.forEachObject((o) => (o.hasControls =false))

    const handleClick = () => {
      const activeObject = canvas.getActiveObject()
      if (activeObject && activeObject.selectable) {
        activeObject.set({ fill: 'rgb(208, 240, 192, 0.2)', stroke: 'rgb(50,205,50)'})
        canvas.renderAll()
  }
}
    canvas.on("mouse:down", handleClick)
    return () => {
      canvas.off("mouse:down", handleClick)
    }
  }
}

export default TransformTool
