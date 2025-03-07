import FabricTool, { ConfigureCanvasProps } from "./fabrictool"
import { fabric } from "fabric"

class TransformTool extends FabricTool {
  private _clipboard: fabric.Object | null = null

  configureCanvas(args: ConfigureCanvasProps): () => void {
    let canvas = this._canvas
    canvas.isDrawingMode = false
    canvas.selection = true
    canvas.forEachObject((o) => (o.selectable = o.evented = true))

    const handleDoubleClick = () => {
      canvas.remove(canvas.getActiveObject())
    }

    canvas.on("mouse:dblclick", handleDoubleClick)

    // Add keyboard event listeners
    document.addEventListener("keydown", this.handleKeyDown)

    return () => {
      canvas.off("mouse:dblclick", handleDoubleClick)
      document.removeEventListener("keydown", this.handleKeyDown)
    }
  }

  // Handle key down for copy and paste
  private handleKeyDown = (e: KeyboardEvent) => {
    if (!this._canvas) return
    if (e.ctrlKey && e.key === "c") {
      this.copy()
    } else if (e.ctrlKey && e.key === "v") {
      this.paste()
    }
  }

  // Copy the active object
  private copy() {
    const activeObject = this._canvas?.getActiveObject()
    if (activeObject) {
      activeObject.clone((cloned: fabric.Object) => {
        this._clipboard = cloned
      })
    }
  }

  // Paste the copied object
  private paste() {
    if (!this._clipboard || !this._canvas) return

    // Clone again to prevent references to the same object
    this._clipboard.clone((clonedObj: fabric.Object) => {
      const left = clonedObj.left ?? 10 // Use a default value or 0 if undefined
      const top = clonedObj.top ?? 10   // Use a default value or 0 if undefined

      this._canvas?.discardActiveObject()
      clonedObj.set({
        left: left + 10, // Ensure it's always offset
        top: top + 10,   // Ensure it's always offset
        evented: true,
      })
      this._canvas?.add(clonedObj)
      this._canvas?.setActiveObject(clonedObj)
      this._canvas?.requestRenderAll()
    })
  }
}

export default TransformTool
