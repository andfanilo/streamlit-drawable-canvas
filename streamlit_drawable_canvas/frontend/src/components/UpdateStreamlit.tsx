import React, { useEffect, useState } from "react"
import sendDataToStreamlit from "../lib/streamlit"
import { fabric } from "fabric"

interface UpdateStreamlitProps {
  shouldSendState: boolean
  stateToSend: Object
  canvasWidth: number
  canvasHeight: number
}

/**
 * Invisible canvas whose sole purpose is to draw current state
 * to send image data to Streamlit
 */
const UpdateStreamlit = (props: UpdateStreamlitProps) => {
  const [stCanvas, setStCanvas] = useState(new fabric.Canvas(""))

  useEffect(() => {
    const stC = new fabric.Canvas("canvas-to-streamlit", {
      enableRetinaScaling: false,
    })
    setStCanvas(stC)
  }, [])

  useEffect(() => {
    if (props.shouldSendState) {
      stCanvas.loadFromJSON(props.stateToSend, () => {
        sendDataToStreamlit(stCanvas)
      })
    }
  }, [stCanvas, props.shouldSendState, props.stateToSend])

  return (
    <canvas
      id="canvas-to-streamlit"
      width={props.canvasWidth}
      height={props.canvasHeight}
    />
  )
}

export default UpdateStreamlit
