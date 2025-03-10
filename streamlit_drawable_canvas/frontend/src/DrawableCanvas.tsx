import React, { useEffect, useState } from "react"
import {
  ComponentProps,
  Streamlit,
  withStreamlitConnection,
} from "streamlit-component-lib"
import { fabric } from "fabric"
import { isEqual } from "lodash"

import CanvasToolbar from "./components/CanvasToolbar"
import UpdateStreamlit from "./components/UpdateStreamlit"

import { useCanvasState } from "./DrawableCanvasState"
import { tools, FabricTool } from "./lib"

function getStreamlitBaseUrl(): string | null {
  const params = new URLSearchParams(window.location.search)
  const baseUrl = params.get("streamlitUrl")
  if (baseUrl == null) {
    return null
  }

  try {
    return new URL(baseUrl).origin
  } catch {
    return null
  }
}

/**
 * Arguments Streamlit receives from the Python side
 */
export interface PythonArgs {
  fillColor: string
  strokeWidth: number
  strokeColor: string
  backgroundColor: string
  backgroundImageURL: string
  realtimeUpdateStreamlit: boolean
  canvasWidth: number
  canvasHeight: number
  drawingMode: string
  initialDrawing: Object
  displayToolbar: boolean
  displayRadius: number
}

/**
 * Define logic for the canvas area
 */
const DrawableCanvas = ({ args }: ComponentProps) => {
  const {
    canvasWidth,
    canvasHeight,
    backgroundColor,
    backgroundImageURL,
    realtimeUpdateStreamlit,
    drawingMode,
    fillColor,
    strokeWidth,
    strokeColor,
    displayRadius,
    initialDrawing,
    displayToolbar,
  }: PythonArgs = args

  /**
   * State initialization
   */
  const [canvas, setCanvas] = useState(new fabric.Canvas(""))
  canvas.stopContextMenu = true
  canvas.fireRightClick = true

  const [backgroundCanvas, setBackgroundCanvas] = useState(
    new fabric.Canvas("")
  )
  const {
    canvasState: {
      action: { shouldReloadCanvas, forceSendToStreamlit, resetView },
      currentState,
      initialState,
    },
    saveState,
    undo,
    redo,
    canUndo,
    canRedo,
    forceStreamlitUpdate,
    resetState,
    initalView,
  } = useCanvasState()

  /**
   * Initialize canvases on component mount
   * NB: Remount component by changing its key instead of defining deps
   */
  useEffect(() => {
    const c = new fabric.Canvas("canvas", {
      enableRetinaScaling: false,
    })
    const imgC = new fabric.Canvas("backgroundimage-canvas", {
      enableRetinaScaling: false,
    })
    setCanvas(c)
    setBackgroundCanvas(imgC)
    Streamlit.setFrameHeight()
  }, [])

  /**
   * Load user drawing into canvas
   * Python-side is in charge of initializing drawing with background color if none provided
   */
  useEffect(() => {
    if (!isEqual(initialState, initialDrawing)) {
      canvas.loadFromJSON(initialDrawing, () => {
        canvas.renderAll()
        resetState(initialDrawing)
      })
    }
  }, [canvas, initialDrawing, initialState, resetState])

  /**
   * Update background image
   */
  useEffect(() => {
    if (backgroundImageURL) {
      var bgImage = new Image();
      bgImage.onload = function() {
        backgroundCanvas.add(new fabric.Image(bgImage));
      };
      const baseUrl = getStreamlitBaseUrl() ?? ""
      bgImage.src = baseUrl + backgroundImageURL
    }
  }, [
    canvas,
    backgroundCanvas,
    canvasHeight,
    canvasWidth,
    backgroundColor,
    backgroundImageURL,
    saveState,
  ])

  /**
   * If state changed from undo/redo/reset, update user-facing canvas
   */
  useEffect(() => {
    if (shouldReloadCanvas) {
      canvas.loadFromJSON(currentState, () => {})
    }
  }, [canvas, shouldReloadCanvas, currentState])

  /**
   * Reset view on resetView state change
   */
  useEffect(() => {
    if (resetView) {
      canvas.setZoom(1.0);
      backgroundCanvas.setZoom(1.0);
      canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
      backgroundCanvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
    }
  }, [canvas, backgroundCanvas, resetView])
  /**
   * Update canvas with selected tool
   * PS: add initialDrawing in dependency so user drawing update reinits tool
   */
  useEffect(() => {
    // Update canvas events with selected tool
    const selectedTool = new tools[drawingMode](canvas) as FabricTool
    const cleanupToolEvents = selectedTool.configureCanvas({
      fillColor: fillColor,
      strokeWidth: strokeWidth,
      strokeColor: strokeColor,
      displayRadius: displayRadius
    })

    canvas.on("mouse:up", (e: any) => {
      saveState(canvas.toJSON())
      if (e["button"] === 3) {
        forceStreamlitUpdate()
      }
    })

    canvas.on("mouse:dblclick", () => {
      saveState(canvas.toJSON())
    })

    function setZoom(canvas: fabric.Canvas, e: WheelEvent) {
      var delta = e.deltaY;
      var offsetX = e.offsetX;
      var offsetY = e.offsetY;
      var zoom = canvas.getZoom();

      zoom *= 0.999 ** delta;
      if (zoom > 20) zoom = 20;
      if (zoom < 0.01) zoom = 0.01;
      canvas.zoomToPoint(new fabric.Point(offsetX, offsetY), zoom);

      var vpt = canvas.viewportTransform? canvas.viewportTransform : [1, 0, 0, 1, 0, 0];
      if (zoom < 400 / 1000) {
        vpt[4] = 200 - 1000 * zoom / 2;
        vpt[5] = 200 - 1000 * zoom / 2;
      } else {
        if (vpt[4] >= 0) {
          vpt[4] = 0;
        } else if (vpt[4] < canvas.getWidth() - 1000 * zoom) {
          vpt[4] = canvas.getWidth() - 1000 * zoom;
        }
        if (vpt[5] >= 0) {
          vpt[5] = 0;
        } else if (vpt[5] < canvas.getHeight() - 1000 * zoom) {
          vpt[5] = canvas.getHeight() - 1000 * zoom;
        }
      }
    }
    
    canvas.on('mouse:wheel', function(opt: any) {
      setZoom(canvas, opt.e);
      setZoom(backgroundCanvas, opt.e);

      opt.e.preventDefault();
      opt.e.stopPropagation();
    });

    


    // Cleanup tool + send data to Streamlit events
    return () => {
      cleanupToolEvents()
      canvas.off("mouse:up")
      canvas.off("mouse:dblclick")
    }
  }, [
    canvas,
    backgroundCanvas,
    strokeWidth,
    strokeColor,
    displayRadius,
    fillColor,
    drawingMode,
    initialDrawing,
    saveState,
    forceStreamlitUpdate,
    initalView,
  ])

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
      {displayToolbar && (
        <CanvasToolbar
          topPosition={canvasHeight}
          leftPosition={canvasWidth}
          canUndo={canUndo}
          canRedo={canRedo}
          downloadCallback={forceStreamlitUpdate}
          undoCallback={undo}
          redoCallback={redo}
          resetCallback={() => {
            resetState(initialState)
          }}
          resetZoomCallback={initalView}
        />
      )}
    </div>
  )
}

export default withStreamlitConnection(DrawableCanvas)
