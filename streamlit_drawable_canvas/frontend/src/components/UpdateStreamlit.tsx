import React, { useEffect, useState } from "react"
import { Streamlit } from "streamlit-component-lib"
import { fabric } from "fabric"

interface UpdateStreamlitProps {
  shouldSendState: boolean
  stateToSend: Object
  canvasWidth: number
  canvasHeight: number
}

/**
 * Download image and JSON data from canvas to send back to Streamlit
 */
const sendDataToStreamlit = (canvas: fabric.Canvas): void => {
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
