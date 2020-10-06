import React, { useEffect, useState } from "react"
import {
  ComponentProps,
  Streamlit,
  withStreamlitConnection,
} from "streamlit-component-lib"
import { fabric } from "fabric"

import { useCanvasState } from "./DrawableCanvasState"

import CanvasToolbar from "./components/CanvasToolbar"
import UpdateStreamlit from "./components/UpdateStreamlit"

import CircleTool from "./lib/circle"
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

  /**
   * State initialization
   */
  const [canvas, setCanvas] = useState(new fabric.Canvas(""))
  const [backgroundCanvas, setBackgroundCanvas] = useState(
    new fabric.StaticCanvas("")
  )
  const {
    canvasState: { reloadState, currentState },
    dispatch,
  } = useCanvasState()

  /**
   * Initialize canvases on component mount
   */
  useEffect(() => {
    const c = new fabric.Canvas("canvas", {
      enableRetinaScaling: false,
    })
    const imgC = new fabric.StaticCanvas("backgroundimage-canvas", {
      enableRetinaScaling: false,
    })
    setCanvas(c)
    setBackgroundCanvas(imgC)
    Streamlit.setFrameHeight()
  }, [canvasHeight, canvasWidth])

  /**
   * If state changed, update user-facing canvas
   */
  useEffect(() => {
    if (reloadState) {
      canvas.loadFromJSON(currentState, () => {})
    }
  }, [canvas, reloadState, updateStreamlit, currentState])

  /**
   * Update background color
   */
  useEffect(() => {
    canvas.setBackgroundColor(backgroundColor, () => {
      canvas.renderAll()
      dispatch({
        type: "save",
        state: canvas.toJSON(),
      })
    })
  }, [canvas, backgroundColor, dispatch])

  /**
   * Update background image
   */
  useEffect(() => {
    if (backgroundImage) {
      const imageData = backgroundCanvas
        .getContext()
        .createImageData(canvasWidth, canvasHeight)
      imageData.data.set(backgroundImage)
      backgroundCanvas.getContext().putImageData(imageData, 0, 0)
    }
  }, [backgroundCanvas, canvasHeight, canvasWidth, backgroundImage, dispatch])

  /**
   * Update canvas with selected tool
   */
  useEffect(() => {
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
          zIndex: -10,
          visibility: "hidden",
        }}
      >
        <UpdateStreamlit
          canvasHeight={canvasHeight}
          canvasWidth={canvasWidth}
          shouldSendState={updateStreamlit}
          stateToSend={currentState}
        />
      </div>
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          zIndex: 0,
        }}
      >
        <canvas
          id="backgroundimage-canvas"
          width={canvasWidth}
          height={canvasHeight}
        />
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
          id="canvas"
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
