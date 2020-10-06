import React, { useEffect, useState } from "react"
import {
  ComponentProps,
  Streamlit,
  withStreamlitConnection,
} from "streamlit-component-lib"
import { fabric } from "fabric"

import { useCanvasState } from "./DrawableCanvasState"
import CanvasToolbar from "./components/CanvasToolbar"

import CircleTool from "./lib/circle"
import FabricTool from "./lib/fabrictool"
import FreedrawTool from "./lib/freedraw"
import LineTool from "./lib/line"
import RectTool from "./lib/rect"
import TransformTool from "./lib/transform"
import sendDataToStreamlit from "./lib/streamlit"

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

// Make TS happy on the Map of selectedTool --> FabricTool
interface Tools {
  [key: string]: FabricTool
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
  const {
    canvasState: { currentState },
    dispatch,
  } = useCanvasState()

  useEffect(() => {
      console.log(currentState)
  }, [currentState])

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
   * Update canvas with background.
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
      canvas.renderAll()
      dispatch({
        type: "save",
        state: canvas.toJSON(),
      })
    })

    Streamlit.setFrameHeight()
  }, [
    canvas,
    backgroundCanvas,
    canvasHeight,
    canvasWidth,
    backgroundColor,
    backgroundImage,
    updateStreamlit,
    dispatch,
  ])

  /**
   * Update canvas with selected tool
   */
  useEffect(() => {
    if (!canvas) {
      return
    }

    // Update canvas events with selected tool
    const tools: Tools = {
      circle: new CircleTool(canvas),
      freedraw: new FreedrawTool(canvas),
      line: new LineTool(canvas),
      rect: new RectTool(canvas),
      transform: new TransformTool(canvas),
    }
    const selectedTool = tools[drawingMode]
    const cleanupToolEvents = selectedTool.configureCanvas(args)

    // Define events to send data back to Streamlit
    const handleSendToStreamlit = () => {
      dispatch({
        type: "save",
        state: canvas.toJSON(),
      })
    }
    const eventsSendToStreamlit = [
      "mouse:up",
      "selection:cleared",
      "selection:updated",
      "object:removed",
      "object:modified",
    ]
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

  /**
   * Render canvas w/ toolbar
   */
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
          style={{ border: "lightgrey 1px solid" }}
        />
      </div>
      <CanvasToolbar
        topPosition={canvasHeight}
        leftPosition={canvasWidth}
        undoCallback={() => {
          dispatch({ type: "undo" })
        }}
        redoCallback={() => {
          dispatch({ type: "redo" })
        }}
        resetCallback={() => {
          canvas.clear()
          canvas.setBackgroundColor(backgroundColor, () => {
            dispatch({
              type: "reset",
              state: canvas.toJSON(),
            })
          })
        }}
      />
    </div>
  )
}

export default withStreamlitConnection(DrawableCanvas)
