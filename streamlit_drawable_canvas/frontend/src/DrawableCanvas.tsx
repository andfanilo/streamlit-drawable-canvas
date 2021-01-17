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
  realtimeUpdateStreamlit: boolean
  canvasWidth: number
  canvasHeight: number
  drawingMode: string
}

// TODO: Should make TS happy on the Map of selectedTool --> FabricTool
const tools: any = {
  circle: CircleTool,
  freedraw: FreedrawTool,
  line: LineTool,
  rect: RectTool,
  transform: TransformTool,
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
    realtimeUpdateStreamlit,
    drawingMode,
    fillColor,
    strokeWidth,
    strokeColor,
  }: PythonArgs = args

  /**
   * State initialization
   */
  const [canvas, setCanvas] = useState(new fabric.Canvas(""))
  const [backgroundCanvas, setBackgroundCanvas] = useState(
    new fabric.StaticCanvas("")
  )
  const {
    canvasState: {
      action: { shouldReloadCanvas, forceSendToStreamlit },
      currentState,
    },
    saveState,
    undo,
    redo,
    canUndo,
    canRedo,
    forceStreamlitUpdate,
    resetState,
  } = useCanvasState()

  /**
   * Initialize canvases on component mount
   * NB: Remount component by changing its key instead of defining deps
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
  }, [])

  /**
   * If state changed from undo/redo, update user-facing canvas
   */
  useEffect(() => {
    if (shouldReloadCanvas) {
      canvas.loadFromJSON(currentState, () => {})
    }
  }, [canvas, shouldReloadCanvas, currentState])

  /**
   * Update background color
   */
  useEffect(() => {
    canvas.setBackgroundColor(backgroundColor, () => {
      canvas.renderAll()
      saveState(canvas.toJSON())
    })
  }, [canvas, backgroundColor, saveState])

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
  }, [backgroundCanvas, canvasHeight, canvasWidth, backgroundImage])

  /**
   * Update canvas with selected tool
   */
  useEffect(() => {
    // Update canvas events with selected tool
    const selectedTool = new tools[drawingMode](canvas) as FabricTool
    const cleanupToolEvents = selectedTool.configureCanvas({
      fillColor: fillColor,
      strokeWidth: strokeWidth,
      strokeColor: strokeColor,
    })

    canvas.on("mouse:up", () => {
      saveState(canvas.toJSON())
    })

    canvas.on("mouse:dblclick", () => {
      saveState(canvas.toJSON())
    })

    // Cleanup tool + send data to Streamlit events
    return () => {
      cleanupToolEvents()
      canvas.off("mouse:up")
    }
  }, [canvas, strokeWidth, strokeColor, fillColor, drawingMode, saveState])

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
          shouldSendToStreamlit={
            realtimeUpdateStreamlit || forceSendToStreamlit
          }
          stateToSendToStreamlit={currentState}
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
        canUndo={canUndo}
        canRedo={canRedo}
        downloadCallback={forceStreamlitUpdate}
        undoCallback={undo}
        redoCallback={redo}
        resetCallback={() => {
          canvas.clear()
          canvas.setBackgroundColor(backgroundColor, () => {
            resetState(canvas.toJSON())
          })
        }}
      />
    </div>
  )
}

export default withStreamlitConnection(DrawableCanvas)
