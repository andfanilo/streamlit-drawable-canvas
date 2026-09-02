import { PencilBrush } from "fabric";
import { FabricTool, ConfigureCanvasProps } from "./fabrictool";

export class FreedrawTool extends FabricTool {
  configureCanvas({
    strokeWidth,
    strokeColor,
  }: ConfigureCanvasProps): () => void {
    this.canvas.isDrawingMode = true;
    // Fabric 7 no longer auto-instantiates freeDrawingBrush.
    this.canvas.freeDrawingBrush = new PencilBrush(this.canvas);
    this.canvas.freeDrawingBrush.width = strokeWidth;
    this.canvas.freeDrawingBrush.color = strokeColor;
    return () => {};
  }
}
