import React, { useEffect, useState } from "react"
import { ComponentProps, Streamlit, withStreamlitConnection } from "./streamlit"
import { fabric } from "fabric"

import FabricTool from "./lib/fabrictool"
import FreedrawTool from "./lib/freedraw"
import LineTool from "./lib/line"
import RectTool from "./lib/rect"
import TransformTool from "./lib/transform"

/**
 * Arguments Streamlit receives from the Python side
 */
export interface PythonArgs {
  fillColor: string
  strokeWidth: number
  strokeColor: string
  backgroundColor: string
  backgroundImage: Uint8ClampedArray
  canvasWidth: number
  canvasHeight: number
  drawingMode: string
}

interface Tools {
  [key: string]: FabricTool
}

/**
 * Download image and JSON data from canvas to send back to Streamlit
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
    raw: JSON.stringify(canvas),
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
    backgroundImage,
    drawingMode,
  }: PythonArgs = args
  const [canvas, setCanvas] = useState(new fabric.Canvas(""))
  const [imageCanvas, setImageCanvas] = useState(new fabric.Canvas(""))

  /**
   * Initialize canvases on component mount
   */
  useEffect(() => {
    const c = new fabric.Canvas("c", {
      enableRetinaScaling: false,
    })
    const imgC = new fabric.Canvas("imgC", {
      enableRetinaScaling: false,
    })
    setCanvas(c)
    setImageCanvas(imgC)
    Streamlit.setFrameHeight()
  }, [canvasHeight, canvasWidth])

  /**
   * Update canvas with background and selected tool
   */
  useEffect(() => {
    if (!canvas) {
      return
    }

    // Update background info
    canvas.backgroundColor = backgroundColor
    if (backgroundImage) {
      const imageData = imageCanvas
        .getContext()
        .createImageData(canvasWidth, canvasHeight)
      imageData.data.set(backgroundImage)
      imageCanvas.getContext().putImageData(imageData, 0, 0)
    }
    Streamlit.setFrameHeight()

    // Update canvas events with selected tool
    const tools: Tools = {
      freedraw: new FreedrawTool(canvas),
      line: new LineTool(canvas),
      rect: new RectTool(canvas),
      transform: new TransformTool(canvas),
    }
    const selectedTool = tools[drawingMode]
    const cleanupToolEvents = selectedTool.configureCanvas(args)

    // Redefine event to send data back to Streamlit
    const onMouseUp = () => {
      sendDataToStreamlit(canvas)
    }
    canvas.on("mouse:up", onMouseUp)

    sendDataToStreamlit(canvas)

    // Run tool cleanup + mouseeventup remove
    return () => {
      cleanupToolEvents()
      canvas.off("mouse:up", onMouseUp)
    }
  })

  return (
    <div style={{ position: "relative" }}>
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          zIndex: 0,
        }}
      >
        <canvas id="imgC" width={canvasWidth} height={canvasHeight} />
      </div>
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          zIndex: 10,
        }}
      >
        <canvas
          id="c"
          width={canvasWidth}
          height={canvasHeight}
          style={{
            border:
              args.backgroundColor === "transparent" ? "1px solid black" : "",
          }}
        />
      </div>
    </div>
  )
}

export default withStreamlitConnection(DrawableCanvas)
