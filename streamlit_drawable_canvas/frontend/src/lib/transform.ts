import FabricTool, { ConfigureCanvasProps } from "./fabrictool"

class TransformTool extends FabricTool {
  configureCanvas(args: ConfigureCanvasProps): () => void {
    let canvas = this._canvas
    canvas.isDrawingMode = false
    canvas.selection = true
    canvas.forEachObject((o) => (o.selectable = o.evented = o.lockMovementX = o.lockMovementY =true))
    canvas.forEachObject((o) => (o.hasControls =false))

    const handleLeftClick = () => {
      const activeObject = canvas.getActiveObject()
      if (activeObject && activeObject.selectable) {
        activeObject.set({fill: 'rgb(1, 50, 32, 0.2)', stroke: 'rgb(50,205,50)'})
        canvas.renderAll()
      }
    }
    const handleRightClick = () => {
      const activeObject = canvas.getActiveObject()
      if (activeObject && activeObject.selectable) {
        activeObject.set({ fill: 'rgb(208, 240, 192, 0.2)', stroke: 'rgb(50,205,50)'})
        canvas.renderAll()
      }
    }
    const handleMouseDown = (options: fabric.IEvent) => {
      // Check if it's a left-click (0) or right-click (2) event
      const mouseEvent = options.e as MouseEvent;
      console.log(mouseEvent.button)
      if (mouseEvent.button === 0) {
        handleLeftClick()
      }
      else if (mouseEvent.button === 2) {
        handleRightClick()
      }
    }
    canvas.on('mouse:down', handleMouseDown)
    return () => {
      canvas.off('mouse:down', handleMouseDown)
    }
  }
}

export default TransformTool
