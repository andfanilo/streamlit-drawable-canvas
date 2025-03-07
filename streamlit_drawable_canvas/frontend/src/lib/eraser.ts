import FabricTool, { ConfigureCanvasProps } from "./fabrictool";
import { fabric } from "fabric"; // Ensure fabric is imported

class EraserTool extends FabricTool {
  configureCanvas({
    strokeWidth,
  }: ConfigureCanvasProps): () => void {
    this._canvas.isDrawingMode = true;

    // Use 'any' to bypass TypeScript type checking for EraserBrush
    const eraserBrush = new (fabric as any).EraserBrush(this._canvas);
    eraserBrush.width = strokeWidth;
    this._canvas.freeDrawingBrush = eraserBrush;

    return () => {
      // Cleanup function if needed
    };
  }
}

export default EraserTool;
