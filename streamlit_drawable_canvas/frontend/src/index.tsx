import React from "react"
import ReactDOM from "react-dom"
import DrawableCanvas from "./DrawableCanvas"
import { CanvasStateProvider } from "./DrawableCanvasState"

import "./index.css"

ReactDOM.render(
  <React.StrictMode>
    <CanvasStateProvider>
      <DrawableCanvas />
    </CanvasStateProvider>
  </React.StrictMode>,
  document.getElementById("root")
)
