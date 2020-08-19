import React, { useEffect, useState } from "react"
import { ComponentProps, Streamlit, withStreamlitConnection } from "./streamlit"
import { fabric } from "fabric"

import FreedrawTool from "./lib/freedraw"
import LineTool from "./lib/line"
import TransformTool from "./lib/transform"

/**
 * Arguments Streamlit receives from the Python side
 */
export interface PythonArgs {
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
    const tools = {
      freedraw: new FreedrawTool(canvas),
      line: new LineTool(canvas),
      transform: new TransformTool(canvas),
    }
    tools[drawingMode].configureCanvas(props.args)
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
