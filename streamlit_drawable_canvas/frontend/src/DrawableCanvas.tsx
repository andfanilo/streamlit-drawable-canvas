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

interface CustomFabricCanvas extends fabric.Canvas {
  isDragging?: boolean;
  selection?: boolean;
  lastPosX?: number;
  lastPosY?: number;
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
  const [canvas, setCanvas] = useState<CustomFabricCanvas>(new fabric.Canvas("") as CustomFabricCanvas);
  canvas.stopContextMenu = true
  canvas.fireRightClick = true

  const [backgroundCanvas, setBackgroundCanvas] = useState<CustomFabricCanvas>(new fabric.Canvas("") as CustomFabricCanvas);
  const {
    canvasState: {
      action: { shouldReloadCanvas, forceSendToStreamlit },
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
        backgroundCanvas.getContext().drawImage(bgImage, 0, 0);
      };
      const params = new URLSearchParams(window.location.search);
      const baseUrl = params.get('streamlitUrl')
      bgImage.src = baseUrl + backgroundImageURL;
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

    canvas.on("mouse:down", function (this: CustomFabricCanvas, opt) {
      var evt = opt.e as MouseEvent;
      if (evt.altKey === true) {
        this.isDragging = true;
        this.selection = false;
        this.lastPosX = evt.clientX;
        this.lastPosY = evt.clientY;
      }
    })

    canvas.on("mouse:move", function (this: CustomFabricCanvas, opt) {
      if (this.isDragging) {
        var e = opt.e as MouseEvent;
        var vpt = this.viewportTransform;
        if (vpt) { // Check if vpt is defined
          vpt[4] += e.clientX - (this.lastPosX || 0);
          vpt[5] += e.clientY - (this.lastPosY || 0);
          this.requestRenderAll();
          this.lastPosX = e.clientX;
          this.lastPosY = e.clientY;
        }
      }
    })
        
    canvas.on("mouse:wheel", function (this: CustomFabricCanvas, opt) {
      var e = opt.e as WheelEvent;
      var delta = e.deltaY;
      var zoom = canvas.getZoom();
      zoom *= 0.999 ** delta;
      if (zoom > 20) zoom = 20;
      if (zoom < 0.01) zoom = 0.01;
      var point = new fabric.Point(e.offsetX, e.offsetY); 
      canvas.zoomToPoint(point, zoom);
      opt.e.preventDefault();
      opt.e.stopPropagation();
    })

    canvas.on("mouse:up", (e: any) => {
      saveState(canvas.toJSON());
      if (e["button"] === 3) {
        forceStreamlitUpdate();
      }
    
      // Add your logic here for handling mouse up events
      canvas.setViewportTransform(canvas.viewportTransform as number[]);
      canvas.isDragging = false;
      canvas.selection = true;
    });

    canvas.on("mouse:dblclick", () => {
      saveState(canvas.toJSON())
    })
    
    backgroundCanvas.on("mouse:down", function (this: CustomFabricCanvas, opt) {
      var evt = opt.e as MouseEvent;
      if (evt.altKey === true) {
        this.isDragging = true;
        this.selection = false;
        this.lastPosX = evt.clientX;
        this.lastPosY = evt.clientY;
      }
    })

    backgroundCanvas.on("mouse:move", function (this: CustomFabricCanvas, opt) {
      if (this.isDragging) {
        var e = opt.e as MouseEvent;
        var vpt = this.viewportTransform;
        if (vpt) { // Check if vpt is defined
          vpt[4] += e.clientX - (this.lastPosX || 0);
          vpt[5] += e.clientY - (this.lastPosY || 0);
          this.requestRenderAll();
          this.lastPosX = e.clientX;
          this.lastPosY = e.clientY;
        }
      }
    })
        
    backgroundCanvas.on("mouse:wheel", function (this: CustomFabricCanvas, opt) {
      var e = opt.e as WheelEvent;
      var delta = e.deltaY;
      var zoom = backgroundCanvas.getZoom();
      zoom *= 0.999 ** delta;
      if (zoom > 20) zoom = 20;
      if (zoom < 0.01) zoom = 0.01;
      var point = new fabric.Point(e.offsetX, e.offsetY); 
      backgroundCanvas.zoomToPoint(point, zoom);
      opt.e.preventDefault();
      opt.e.stopPropagation();
    })

    backgroundCanvas.on("mouse:up", (e: any) => {
      saveState(backgroundCanvas.toJSON());
      if (e["button"] === 3) {
        forceStreamlitUpdate();
      }
      // Add your logic here for handling mouse up events
      backgroundCanvas.setViewportTransform(backgroundCanvas.viewportTransform as number[]);
      backgroundCanvas.isDragging = false;
      backgroundCanvas.selection = true;
    })

    backgroundCanvas.on("mouse:dblclick", () => {
      saveState(backgroundCanvas.toJSON())
    })


    // Cleanup tool + send data to Streamlit events
    return () => {
      cleanupToolEvents()
      canvas.off("mouse:down")
      canvas.off("mouse:move")
      canvas.off("mouse:up")
      canvas.off("mouse:wheel")
      canvas.off("mouse:dblclick")
      backgroundCanvas.off("mouse:down")
      backgroundCanvas.off("mouse:move")
      backgroundCanvas.off("mouse:up")
      backgroundCanvas.off("mouse:wheel")
      backgroundCanvas.off("mouse:dblclick")
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
        />
      )}
    </div>
  )
}

export default withStreamlitConnection(DrawableCanvas)
