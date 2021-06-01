import { fabric } from "fabric"
import FabricTool, { ConfigureCanvasProps } from "./fabrictool"

class CircleTool extends FabricTool {
  isMouseDown: boolean = false
  fillColor: string = "#ffffff"
  strokeWidth: number = 10
  strokeColor: string = "#ffffff"
  currentCircle: fabric.Circle = new fabric.Circle()
  currentStartX: number = 0
  currentStartY: number = 0
  _minRadius: number = 10

  configureCanvas({
    strokeWidth,
    strokeColor,
    fillColor,
  }: ConfigureCanvasProps): () => void {
    this._canvas.isDrawingMode = false
    this._canvas.selection = false
    this._canvas.forEachObject((o) => (o.selectable = o.evented = false))

    this.strokeWidth = strokeWidth
    this.strokeColor = strokeColor
    this.fillColor = fillColor
    this._minRadius = strokeWidth

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
    this.currentStartX = pointer.x
    this.currentStartY = pointer.y
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
      radius: this._minRadius,
    })
    if (_clicked === 0) {
      canvas.add(this.currentCircle)
    }
  }

  onMouseMove(o: any) {
    if (!this.isMouseDown) return
    let canvas = this._canvas
    let pointer = canvas.getPointer(o.e)
    let _radius =
      this.linearDistance(
        { x: this.currentStartX, y: this.currentStartY },
        { x: pointer.x, y: pointer.y }
      ) / 2
    this.currentCircle.set({
      radius: Math.max(_radius, this._minRadius),
      angle:
        (Math.atan2(
          pointer.y - this.currentStartY,
          pointer.x - this.currentStartX
        ) *
          180) /
        Math.PI,
    })
    this.currentCircle.setCoords()
    canvas.renderAll()
  }

  onMouseUp(o: any) {
    this.isMouseDown = false
  }

  onMouseOut(o: any) {
    this.isMouseDown = false
  }

  /**
   * Calculate the distance of two x,y points
   *
   * @param point1 an object with x,y attributes representing the start point
   * @param point2 an object with x,y attributes representing the end point
   *
   * @returns {number}
   */
  linearDistance = (point1: any, point2: any) => {
    let xs = point2.x - point1.x
    let ys = point2.y - point1.y
    return Math.sqrt(xs * xs + ys * ys)
  }
}

export default CircleTool
