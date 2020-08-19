import React, { useEffect, useState } from "react"
import { ComponentProps, Streamlit, withStreamlitConnection } from "./streamlit"
import { fabric } from "fabric"

import configureFreedraw from "./lib/freedraw"
import configureLine from "./lib/line"
import configureTransform from "./lib/transform"

/**
 * Arguments Streamlit receives from the Python side
 */
interface PythonArgs {
  brushWidth: number
  brushColor: string
  backgroundColor: string
  canvasWidth: number
  canvasHeight: number
  drawingMode: "freedraw" | "line" | "transform"
}

const DrawableCanvas = (props: ComponentProps) => {
  const {
    canvasWidth,
    canvasHeight,
    backgroundColor,
    brushWidth,
    brushColor,
    drawingMode,
  }: PythonArgs = props.args
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
    canvas.backgroundColor = backgroundColor
    switch (drawingMode) {
      case "freedraw": {
        configureFreedraw(canvas, brushWidth, brushColor)
        break
      }
      case "transform": {
        configureTransform(canvas)
        break
      }
      case "line": {
        configureLine(canvas)
        break
      }
      default: {
        // any other nonfree drawing option
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
