import { Circle, TPointerEventInfo, TPointerEvent } from "fabric";
import { FabricTool, ConfigureCanvasProps } from "./fabrictool";

const linearDistance = (
  point1: { x: number; y: number },
  point2: { x: number; y: number }
): number => {
  const xs = point2.x - point1.x;
  const ys = point2.y - point1.y;
  return Math.sqrt(xs * xs + ys * ys);
};

export class CircleTool extends FabricTool {
  private isMouseDown = false;
  private fillColor = "#ffffff";
  private strokeWidth = 10;
  private strokeColor = "#ffffff";
  private currentCircle: Circle = new Circle();
  private currentStartX = 0;
  private currentStartY = 0;
  private minRadius = 10;

  configureCanvas({
    strokeWidth,
    strokeColor,
    fillColor,
  }: ConfigureCanvasProps): () => void {
    this.canvas.isDrawingMode = false;
    this.canvas.selection = false;
    this.canvas.forEachObject((o) => (o.selectable = o.evented = false));

    this.strokeWidth = strokeWidth;
    this.strokeColor = strokeColor;
    this.fillColor = fillColor;
    this.minRadius = strokeWidth;

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
    this.currentStartX = pointer.x;
    this.currentStartY = pointer.y;
    this.currentCircle = new Circle({
      left: this.currentStartX,
      top: this.currentStartY,
      originX: "left",
      originY: "center",
      strokeWidth: this.strokeWidth,
      stroke: this.strokeColor,
      fill: this.fillColor,
      selectable: false,
      evented: false,
      radius: this.minRadius,
    });
    if (clicked === 0) {
      canvas.add(this.currentCircle);
    }
  }

  private onMouseMove(o: TPointerEventInfo<TPointerEvent>) {
    if (!this.isMouseDown) return;
    const canvas = this.canvas;
    const pointer = canvas.getScenePoint(o.e);
    const radius =
      linearDistance(
        { x: this.currentStartX, y: this.currentStartY },
        { x: pointer.x, y: pointer.y }
      ) / 2;
    this.currentCircle.set({
      radius: Math.max(radius, this.minRadius),
      angle:
        (Math.atan2(
          pointer.y - this.currentStartY,
          pointer.x - this.currentStartX
        ) *
          180) /
        Math.PI,
    });
    this.currentCircle.setCoords();
    canvas.renderAll();
  }

  private onMouseUp() {
    this.isMouseDown = false;
  }

  private onMouseOut() {
    this.isMouseDown = false;
  }
}
