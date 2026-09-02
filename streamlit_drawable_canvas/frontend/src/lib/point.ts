import { fabric } from "fabric"
import FabricTool, { ConfigureCanvasProps } from "./fabrictool"

class PointTool extends FabricTool {
  isMouseDown: boolean = false
  fillColor: string = "#ffffff"
  strokeWidth: number = 10
  strokeColor: string = "#ffffff"
  currentCircle: fabric.Circle = new fabric.Circle()
  currentStartX: number = 0
  currentStartY: number = 0
  displayRadius: number = 1

  configureCanvas({
    strokeWidth,
    strokeColor,
    fillColor,
    displayRadius
  }: ConfigureCanvasProps): () => void {
    this._canvas.isDrawingMode = false
    this._canvas.selection = false
    this._canvas.forEachObject((o) => (o.selectable = o.evented = false))

    this.strokeWidth = strokeWidth
    this.strokeColor = strokeColor
    this.fillColor = fillColor
    this.displayRadius = displayRadius

    this._canvas.on("mouse:down", (e: any) => this.onMouseDown(e))
    this._canvas.on("mouse:move", (e: any) => this.onMouseMove(e))
    this._canvas.on("mouse:up", (e: any) => this.onMouseUp(e))
    this._canvas.on("mouse:out", (e: any) => this.onMouseOut(e))
    return () => {
      this._canvas.off("mouse:down")
      this._canvas.off("mouse:move")
      this._canvas.off("mouse:up")
      this._canvas.off("mouse:out")
    }
  }

  onMouseDown(o: any) {
    let canvas = this._canvas
    let _clicked = o.e["button"]
    this.isMouseDown = true
    let pointer = canvas.getPointer(o.e)
    this.currentStartX = pointer.x - (this.displayRadius + this.strokeWidth / 2.)
    this.currentStartY = pointer.y //- (this._minRadius + this.strokeWidth)
    this.currentCircle = new fabric.Circle({
      left: this.currentStartX,
      top: this.currentStartY,
      originX: "left",
      originY: "center",
      strokeWidth: this.strokeWidth,
      stroke: this.strokeColor,
      fill: this.fillColor,
      selectable: false,
      evented: false,
      radius: this.displayRadius,
    })
    if (_clicked === 0) {
      canvas.add(this.currentCircle)
    }
  }

  onMouseMove(o: any) {
    if (!this.isMouseDown) return
    let canvas = this._canvas
    this.currentCircle.setCoords()
    canvas.renderAll()
  }

  onMouseUp(o: any) {
    this.isMouseDown = false
  }

  onMouseOut(o: any) {
    this.isMouseDown = false
  }

}

export default PointTool
