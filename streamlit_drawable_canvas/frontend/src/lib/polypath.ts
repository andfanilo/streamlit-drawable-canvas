import { fabric } from "fabric"
import FabricTool, { ConfigureCanvasProps } from "./fabrictool"

class PolypathTool extends FabricTool {
  isMouseDown: boolean = false
  fillColor: string = "#ffffff"
  strokeWidth: number = 10
  strokeColor: string = "#ffffff"
  currentLine: fabric.Line = new fabric.Line()
  currentPath: fabric.Path = new fabric.Path()
  _pathString: string = "M "

  configureCanvas({
    strokeWidth,
    strokeColor,
    fillColor,
  }: ConfigureCanvasProps): () => void {
    this._canvas.isDrawingMode = false
    this._canvas.selection = false
    this._canvas.forEachObject((o) => (o.selectable = o.evented = false))

    this._canvas.fireRightClick = true
    this._canvas.stopContextMenu = true

    this.strokeWidth = strokeWidth
    this.strokeColor = strokeColor
    this.fillColor = fillColor

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
    let _start = false
    if (this._pathString === "M ") {
      _start = true
    }

    this.isMouseDown = true
    var pointer = canvas.getPointer(o.e)

    var points = [pointer.x, pointer.y, pointer.x, pointer.y]
    canvas.remove(this.currentLine)
    this.currentLine = new fabric.Line(points, {
      strokeWidth: this.strokeWidth,
      fill: this.strokeColor,
      stroke: this.strokeColor,
      originX: "center",
      originY: "center",
      selectable: false,
      evented: false,
    })
    if (_clicked === 0) {
      canvas.add(this.currentLine)
    }

    if (_start) {
      // Initialize pathString
      this._pathString += `${pointer.x} ${pointer.y} `
      _start = false
    } else {
      canvas.remove(this.currentPath)
      if (_clicked === 0) {
        // Update pathString
        this._pathString += `L ${pointer.x} `
        this._pathString += `${pointer.y} `
      }
      if (_clicked === 2) {
        // Close pathString
        this._pathString += "z"
      }
    }
    this.currentPath = new fabric.Path(this._pathString, {
      strokeWidth: this.strokeWidth,
      fill: this.fillColor,
      stroke: this.strokeColor,
      originX: "center",
      originY: "center",
      selectable: false,
      evented: false,
    })
    canvas.add(this.currentPath)
    if (_clicked === 2) {
      this._pathString = "M "
    }
  }

  onMouseMove(o: any) {
    if (!this.isMouseDown) return
    let canvas = this._canvas
    var pointer = canvas.getPointer(o.e)
    this.currentLine.set({ x2: pointer.x, y2: pointer.y })
    this.currentLine.setCoords()
    canvas.renderAll()
  }

  onMouseUp(o: any) {
    this.isMouseDown = true
  }

  onMouseOut(o: any) {
    this.isMouseDown = false
  }
}

export default PolypathTool
