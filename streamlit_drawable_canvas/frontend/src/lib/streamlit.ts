import { Streamlit } from "streamlit-component-lib"

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

export default sendDataToStreamlit
