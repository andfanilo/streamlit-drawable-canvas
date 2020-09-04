import React, { useEffect, useState } from "react"
import {
  ComponentProps,
  Streamlit,
  withStreamlitConnection,
} from "streamlit-component-lib"
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
  updateStreamlit: boolean
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
    raw: canvas.toObject(),
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
    updateStreamlit,
    drawingMode,
  }: PythonArgs = args
  const [canvas, setCanvas] = useState(new fabric.Canvas(""))
  const [backgroundCanvas, setBackgroundCanvas] = useState(
    new fabric.StaticCanvas("")
  )

  /**
   * Initialize canvases on component mount
   */
  useEffect(() => {
    const c = new fabric.Canvas("c", {
      enableRetinaScaling: false,
    })
    const imgC = new fabric.StaticCanvas("imgC", {
      enableRetinaScaling: false,
    })
    setCanvas(c)
    setBackgroundCanvas(imgC)
    Streamlit.setFrameHeight()
  }, [canvasHeight, canvasWidth])

  /**
   * Update canvas with background and selected tool
   * Then send back data to Streamlit
   */
  useEffect(() => {
    if (!canvas) {
      return
    }

    canvas.setBackgroundColor(backgroundColor, () => {
      if (backgroundImage) {
        const imageData = backgroundCanvas
          .getContext()
          .createImageData(canvasWidth, canvasHeight)
        imageData.data.set(backgroundImage)
        backgroundCanvas.getContext().putImageData(imageData, 0, 0)
      }
      sendDataToStreamlit(canvas) // send back in case update prop reran the effect
    })
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

    // Define events to send data back to Streamlit
    const handleSendToStreamlit = () => {
      sendDataToStreamlit(canvas)
    }
    const eventsSendToStreamlit = updateStreamlit
      ? [
          "selection:cleared",
          "selection:updated",
          "object:added",
          "object:removed",
          "object:modified",
        ]
      : []
    eventsSendToStreamlit.forEach((event) =>
      canvas.on(event, handleSendToStreamlit)
    )

    // Cleanup tool + send data to Streamlit events
    return () => {
      cleanupToolEvents()
      eventsSendToStreamlit.forEach((event) =>
        canvas.off(event, handleSendToStreamlit)
      )
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
        <canvas id="c" width={canvasWidth} height={canvasHeight} />
      </div>
    </div>
  )
}

export default withStreamlitConnection(DrawableCanvas)
