import React, { useEffect, useState } from "react"
import { ComponentProps, Streamlit, withStreamlitConnection } from "./streamlit"
import { fabric } from "fabric"

/**
 * Arguments Streamlit receives from the Python side
 */
interface PythonArgs {
  brushWidth: number
  brushColor: string
  backgroundColor: string
  canvasWidth: number
  canvasHeight: number
  drawingMode: "free" | "line" | "transform"
}

const DrawableCanvas = (props: ComponentProps) => {
  const { canvasWidth, canvasHeight }: PythonArgs = props.args
  const [canvas, setCanvas] = useState(new fabric.Canvas(""))

  /**
   * Initialize canvas on mount
   */
  useEffect(() => {
    const canvas = new fabric.Canvas("c", {
      enableRetinaScaling: false,
    })
    setCanvas(canvas)
    Streamlit.setFrameHeight()
  }, [canvasHeight, canvasWidth])

  /**
   * Update canvas with background, brush or path configuration.
   */
  useEffect(() => {
    const {
      backgroundColor,
      brushWidth,
      brushColor,
      drawingMode,
    }: PythonArgs = props.args
    canvas.backgroundColor = backgroundColor
    canvas.freeDrawingBrush.width = brushWidth
    canvas.freeDrawingBrush.color = brushColor
    switch (drawingMode) {
      case "free": {
        canvas.isDrawingMode = true
        break
      }
      case "transform": {
        canvas.isDrawingMode = false
        canvas.selection = true
        canvas.getObjects().forEach((obj) => obj.set("selectable", true))
        break
      }
      default: {
        // any other nonfree drawing option like line or box
        canvas.isDrawingMode = false
        canvas.selection = false
        canvas.getObjects().forEach((obj) => obj.set("selectable", false))
        break
      }
    }
  })

  /**
   * Send image data to Streamlit on mouse up on canvas
   * Delete selected object on mouse doubleclick
   */
  useEffect(() => {
    if (!canvas) {
      return
    }
    const handleMouseUp = () => {
      canvas.renderAll()
      const imageData = canvas
        .getContext()
        .getImageData(0, 0, canvasWidth, canvasHeight)
      const data = Array.from(imageData["data"])
      Streamlit.setComponentValue({
        data: data,
        width: imageData["width"],
        height: imageData["height"],
      })
    }
    handleMouseUp()
    canvas.on("mouse:up", handleMouseUp)
    canvas.on("mouse:dblclick", () => {
      canvas.remove(canvas.getActiveObject())
    })
    return () => {
      canvas.off("mouse:up")
      canvas.off("mouse:dblclick")
    }
  })

  return (
    <>
      <canvas id="c" width={canvasWidth} height={canvasHeight} />
    </>
  )
}

export default withStreamlitConnection(DrawableCanvas)
