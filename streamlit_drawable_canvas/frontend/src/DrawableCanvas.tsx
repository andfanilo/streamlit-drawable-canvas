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
  fontFamily: string
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
	fontFamily,
  }: PythonArgs = args

  /**
   * State initialization
   */
  const [canvas, setCanvas] = useState(new fabric.Canvas(""))
  canvas.stopContextMenu = true
  canvas.fireRightClick = true

  const [backgroundCanvas, setBackgroundCanvas] = useState(
    new fabric.StaticCanvas("")
  )
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
  
  
  const resetZoom = () => {
  canvas.setZoom(1) // Reset zoom to default (1)
  canvas.setViewportTransform([1, 0, 0, 1, 0, 0]) // Reset the viewport transform
  canvas.renderAll() // Re-render the canvas to apply the reset
}


  /**
   * Initialize canvases on component mount
   * NB: Remount component by changing its key instead of defining deps
   */
// Initialize the canvas only once
useEffect(() => {
  const c = new fabric.Canvas("canvas", {
    enableRetinaScaling: false,
  });
  const imgC = new fabric.StaticCanvas("backgroundimage-canvas", {
    enableRetinaScaling: false,
  });
  setCanvas(c);
  setBackgroundCanvas(imgC);
  Streamlit.setFrameHeight();
  
  // Clean up the canvas on component unmount to avoid memory leaks
  return () => {
    c.dispose();
    imgC.dispose();
  };
}, []);

useEffect(() => {
  const handleZoom = (event: WheelEvent) => {
    event.preventDefault()
    const delta = event.deltaY
    let zoom = canvas.getZoom()
    zoom = zoom + delta * -0.001 // Adjust zoom sensitivity
    zoom = Math.max(0.5, Math.min(zoom, 18)) // Limit zoom level
    const pointer = canvas.getPointer(event as unknown as MouseEvent)

    // Create a fabric.Point from the pointer
    const point = new fabric.Point(pointer.x, pointer.y)

    // Use fabric.Point in the zoomToPoint method
    canvas.zoomToPoint(point, zoom)
  }

  // Use the native addEventListener for the canvas' container element
  const canvasElement = canvas.getElement().parentNode
  if (canvasElement) {
    canvasElement.addEventListener("wheel", (event) => handleZoom(event as WheelEvent))
  }

  return () => {
    if (canvasElement) {
      canvasElement.removeEventListener("wheel", (event) => handleZoom(event as WheelEvent))
    }
  }
}, [canvas])


// Handle resize logic without reinitializing the canvas
useEffect(() => {
  const handleResize = () => {
    // Check if the canvas exists
    if (!canvas) return;

    // Save the current state before resizing
    const savedState = canvas.toJSON();

    // Resize the canvas
    canvas.setDimensions({
      width: canvasWidth,
      height: canvasHeight,
    });

    backgroundCanvas.setDimensions({
      width: canvasWidth,
      height: canvasHeight,
    });

    // Reload the saved state after resizing
    canvas.loadFromJSON(savedState, () => {
      canvas.renderAll();
    });
  };

  // Call the resize handler whenever width or height changes
  handleResize();
}, [canvasWidth, canvasHeight, canvas, backgroundCanvas]);
  
  
  

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
   * Update background image and ensure it persists through undo/redo
   */
useEffect(() => {
  const setBackgroundImage = () => {
    if (backgroundImageURL) {
      const baseUrl = getStreamlitBaseUrl() ?? ""
      fabric.Image.fromURL(baseUrl + backgroundImageURL, (img) => {
        // Ensure the image scales to fit the canvas dimensions
        img.scaleToWidth(canvasWidth)
        img.scaleToHeight(canvasHeight)
        img.set({
          selectable: false, // Prevent users from selecting the background image
          evented: false,    // Disable events on the background image
          excludeFromExport: true, // Exclude this image from being exported
        })

        // Set the image as the background of the canvas
        canvas.setBackgroundImage(img, canvas.renderAll.bind(canvas))
      })
    }
  }

  // Set the background image initially
  setBackgroundImage()

  // Ensure the background image is reapplied after undo/redo
  if (shouldReloadCanvas) {
    canvas.loadFromJSON(currentState, () => {
      canvas.renderAll()
      setBackgroundImage() // Reapply the background image after loading the state
    })
  }
}, [
  canvas,
  backgroundCanvas,
  canvasHeight,
  canvasWidth,
  backgroundColor,
  backgroundImageURL,
  currentState,
  shouldReloadCanvas,
  saveState,
])

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
      displayRadius: displayRadius,
	  fontFamily: fontFamily
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

    // Cleanup tool + send data to Streamlit events
    return () => {
      cleanupToolEvents()
      canvas.off("mouse:up")
      canvas.off("mouse:dblclick")
    }
  }, [
    canvas,
    strokeWidth,
    strokeColor,
    displayRadius,
    fillColor,
	fontFamily,
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
		  resetZoomCallback={resetZoom}

        />
      )}
    </div>
  )
}

export default withStreamlitConnection(DrawableCanvas)
