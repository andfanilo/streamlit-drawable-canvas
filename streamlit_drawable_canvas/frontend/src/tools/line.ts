import { Line, TPointerEventInfo, TPointerEvent } from "fabric";
import { FabricTool, ConfigureCanvasProps } from "./fabrictool";

export class LineTool extends FabricTool {
  private isMouseDown = false;
  private strokeWidth = 10;
  private strokeColor = "#ffffff";
  private currentLine: Line = new Line();

  configureCanvas({
    strokeWidth,
    strokeColor,
  }: ConfigureCanvasProps): () => void {
    this.canvas.isDrawingMode = false;
    this.canvas.selection = false;
    this.canvas.forEachObject((o) => (o.selectable = o.evented = false));

    this.strokeWidth = strokeWidth;
    this.strokeColor = strokeColor;

    const onMouseDown = (o: TPointerEventInfo<TPointerEvent>) =>
      this.onMouseDown(o);
    const onMouseMove = (o: TPointerEventInfo<TPointerEvent>) =>
      this.onMouseMove(o);
    const onMouseUp = () => this.onMouseUp();
    const onMouseOut = () => this.onMouseOut();

    this.canvas.on("mouse:down", onMouseDown);
    this.canvas.on("mouse:move", onMouseMove);
    this.canvas.on("mouse:up", onMouseUp);
    this.canvas.on("mouse:out", onMouseOut);
    return () => {
      this.canvas.off("mouse:down", onMouseDown);
      this.canvas.off("mouse:move", onMouseMove);
      this.canvas.off("mouse:up", onMouseUp);
      this.canvas.off("mouse:out", onMouseOut);
    };
  }

  private onMouseDown(o: TPointerEventInfo<TPointerEvent>) {
    const canvas = this.canvas;
    const clicked = (o.e as MouseEvent).button;
    this.isMouseDown = true;
    const pointer = canvas.getScenePoint(o.e);
    this.currentLine = new Line([pointer.x, pointer.y, pointer.x, pointer.y], {
      strokeWidth: this.strokeWidth,
      fill: this.strokeColor,
      stroke: this.strokeColor,
      originX: "center",
      originY: "center",
      selectable: false,
      evented: false,
    });
    if (clicked === 0) {
      canvas.add(this.currentLine);
    }
  }

  private onMouseMove(o: TPointerEventInfo<TPointerEvent>) {
    if (!this.isMouseDown) return;
    const canvas = this.canvas;
    const pointer = canvas.getScenePoint(o.e);
    this.currentLine.set({ x2: pointer.x, y2: pointer.y });
    this.currentLine.setCoords();
    canvas.renderAll();
  }

  private onMouseUp() {
    this.isMouseDown = false;
    const canvas = this.canvas;
    if (this.currentLine.width === 0 && this.currentLine.height === 0) {
      canvas.remove(this.currentLine);
    }
  }

  private onMouseOut() {
    this.isMouseDown = false;
  }
}
