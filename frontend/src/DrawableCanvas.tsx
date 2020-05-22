import React, {useEffect, useState} from "react"
import {ComponentProps, Streamlit, withStreamlitConnection,} from "./streamlit"
import {fabric} from 'fabric'

import styles from "./DrawableCanvas.module.css"

const DEFAULT_BRUSH_WIDTH = 20
const DEFAULT_BRUSH_COLOR = "black"
const DEFAULT_BG_COLOR = "#eee";
const DEFAULT_WIDTH = 400
const DEFAULT_HEIGHT = 400

const DrawableCanvas = (props: ComponentProps) => {

    const canvasWidth = props.args.width || DEFAULT_WIDTH
    const canvasHeight = props.args.height || DEFAULT_HEIGHT
    const [canvas, setCanvas] = useState(new fabric.Canvas(""))

    /**
     * Initialize canvas on mount
     */
    useEffect(() => {
        const canvas = new fabric.Canvas('c', {
            isDrawingMode: true
        })
        setCanvas(canvas)
    }, []);

    /**
     * Update canvas with new background color and brush at each rerender.
     * No need to control deps.
     */
    useEffect(() => {
        canvas.backgroundColor = props.args.background_color || DEFAULT_BG_COLOR;
        canvas.freeDrawingBrush.width = props.args.brush_width || DEFAULT_BRUSH_WIDTH;
        canvas.freeDrawingBrush.color = props.args.brush_color || DEFAULT_BRUSH_COLOR;
    })

    /**
     * Send image data to Streamlit.
     * Attach this to mouse:up callback on canvas.
     */
    useEffect(() => {
        if (!canvas) {
            return;
        }
        const handleMouseUp = () => {
            canvas.renderAll()
            const imageData = canvas.getContext().getImageData(0, 0, canvasWidth, canvasHeight)
            const data = Array.from(imageData['data'])
            Streamlit.setComponentValue({data: data, width: imageData['width'], height: imageData['height']})
        }
        handleMouseUp()
        canvas.on("mouse:up", handleMouseUp)
        return () => {
            canvas.off("mouse:up");
        }
    })

    useEffect(() => {
        Streamlit.setFrameHeight()
    })

    return (
        <div className={styles.container}>
            <canvas id="c" width={canvasWidth} height={canvasHeight}/>
        </div>
    )
}

export default withStreamlitConnection(DrawableCanvas)
