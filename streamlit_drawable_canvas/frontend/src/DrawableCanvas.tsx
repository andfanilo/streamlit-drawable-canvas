import React, { useEffect, useState } from "react"
import { ComponentProps, Streamlit, withStreamlitConnection } from "./streamlit"
import { fabric } from "fabric"

import FabricTool from "./lib/fabrictool"
import FreedrawTool from "./lib/freedraw"
import LineTool from "./lib/line"
import TransformTool from "./lib/transform"

/**
 * Arguments Streamlit receives from the Python side
 */
export interface PythonArgs {
  strokeWidth: number
  strokeColor: string
  backgroundColor: string
  canvasWidth: number
  canvasHeight: number
  drawingMode: string
}

interface Tools {
  [key: string]: FabricTool
}

/**
 * Download data from canvas to send back to Streamlit
 */
export function sendDataToStreamlit(canvas: fabric.Canvas): void {
  canvas.renderAll()
  const imageData = canvas
    .getContext()
    .getImageData(0, 0, canvas.getWidth(), canvas.getHeight())
  const data = Array.from(imageData["data"])
  Streamlit.setComponentValue({
    data: data,
    width: imageData["width"],
    height: imageData["height"],
  })
}

/**
 * Define logic for the canvas area
 */
const DrawableCanvas = ({ args }: ComponentProps) => {
  const {
    canvasWidth,
    canvasHeight,
    backgroundColor,
    drawingMode,
  }: PythonArgs = args
  const [canvas, setCanvas] = useState(new fabric.Canvas(""))

  /**
   * Initialize canvas on component mount
   */
  useEffect(() => {
    const c = new fabric.Canvas("c", {
      enableRetinaScaling: false,
    })
    setCanvas(c)
    Streamlit.setFrameHeight()
  }, [canvasHeight, canvasWidth])

  /**
   * Update canvas with background and selected tool
   */
  useEffect(() => {
    if (!canvas) {
      return
    }

    canvas.backgroundColor = backgroundColor

    const tools: Tools = {
      freedraw: new FreedrawTool(canvas),
      line: new LineTool(canvas),
      transform: new TransformTool(canvas),
    }
    const selectedTool = tools[drawingMode]
    const cleanup = selectedTool.configureCanvas(args)

    const onMouseUp = () => {
      sendDataToStreamlit(canvas)
    }
    canvas.on("mouse:up", onMouseUp)

    sendDataToStreamlit(canvas)

    // Run tool cleanup + mouseeventup remove
    return () => {
      cleanup()
      canvas.off("mouse:up", onMouseUp)
    }
  })

  return (
    <>
      <canvas id="c" width={canvasWidth} height={canvasHeight} />
    </>
  )
}

export default withStreamlitConnection(DrawableCanvas)
