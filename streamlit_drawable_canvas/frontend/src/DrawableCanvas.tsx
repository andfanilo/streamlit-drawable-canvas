import React, {useEffect, useState} from "react"
import {ComponentProps, Streamlit, withStreamlitConnection,} from "./streamlit"
import {fabric} from 'fabric'

import styles from "./DrawableCanvas.module.css"

/**
 * Arguments Streamlit receives from the Python side
 */
interface PythonArgs {
    brushWidth: number
    brushColor: string
    backgroundColor: string
    canvasWidth: number
    canvasHeight: number
    isDrawingMode: boolean
}

const DrawableCanvas = (props: ComponentProps) => {

    const {canvasWidth, canvasHeight}: PythonArgs = props.args
    const [canvas, setCanvas] = useState(new fabric.Canvas(""))

    /**
     * Initialize canvas on mount
     */
    useEffect(() => {
        const canvas = new fabric.Canvas('c', {
            isDrawingMode: true
        })
        setCanvas(canvas)
        Streamlit.setFrameHeight()
    }, []);

    /**
     * Update canvas with new background color and brush at each rerender.
     * No need to control deps.
     */
    useEffect(() => {
        const {backgroundColor, brushWidth, brushColor, isDrawingMode}: PythonArgs = props.args
        canvas.backgroundColor = backgroundColor
        canvas.freeDrawingBrush.width = brushWidth
        canvas.freeDrawingBrush.color = brushColor
        canvas.isDrawingMode = isDrawingMode
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

    return (
        <div className={styles.container}>
            <canvas id="c" width={canvasWidth} height={canvasHeight}/>
        </div>
    )
}

export default withStreamlitConnection(DrawableCanvas)
