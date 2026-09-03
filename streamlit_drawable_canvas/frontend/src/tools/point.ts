import { Circle, TPointerEventInfo, TPointerEvent } from "fabric";
import { FabricTool, ConfigureCanvasProps } from "./fabrictool";

export class PointTool extends FabricTool {
  private isMouseDown = false;
  private fillColor = "#ffffff";
  private strokeWidth = 10;
  private strokeColor = "#ffffff";
  private currentCircle: Circle = new Circle();
  private currentStartX = 0;
  private currentStartY = 0;
  private displayRadius = 1;

  configureCanvas({
    strokeWidth,
    strokeColor,
    fillColor,
    displayRadius,
  }: ConfigureCanvasProps): () => void {
    this.canvas.isDrawingMode = false;
    this.canvas.selection = false;
    this.canvas.forEachObject((o) => (o.selectable = o.evented = false));

    this.strokeWidth = strokeWidth;
    this.strokeColor = strokeColor;
    this.fillColor = fillColor;
    this.displayRadius = displayRadius;

    const onMouseDown = (o: TPointerEventInfo<TPointerEvent>) =>
      this.onMouseDown(o);
    const onMouseMove = () => this.onMouseMove();
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
    this.currentStartX =
      pointer.x - (this.displayRadius + this.strokeWidth / 2);
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
      radius: this.displayRadius,
    });
    if (clicked === 0) {
      canvas.add(this.currentCircle);
    }
  }

  private onMouseMove() {
    if (!this.isMouseDown) return;
    this.currentCircle.setCoords();
    this.canvas.renderAll();
  }

  private onMouseUp() {
    this.isMouseDown = false;
  }

  private onMouseOut() {
    this.isMouseDown = false;
  }
}
