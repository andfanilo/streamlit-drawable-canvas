import { TPointerEventInfo, TPointerEvent } from "fabric";
import { FabricTool, ConfigureCanvasProps } from "./fabrictool";
import { LabeledRect } from "./labeled";

export class LabeledRectTool extends FabricTool {
  private isMouseDown = false;
  private fillColor = "#ffffff";
  private strokeWidth = 10;
  private strokeColor = "#ffffff";
  private label = "";
  private fontSize = 20;
  private currentRect: LabeledRect = new LabeledRect();
  private currentStartX = 0;
  private currentStartY = 0;
  private minLength = 10;

  configureCanvas({
    strokeWidth,
    strokeColor,
    fillColor,
    label,
    fontSize,
  }: ConfigureCanvasProps): () => void {
    this.canvas.isDrawingMode = false;
    this.canvas.selection = false;
    this.canvas.forEachObject((o) => (o.selectable = o.evented = false));

    this.strokeWidth = strokeWidth;
    this.strokeColor = strokeColor;
    this.fillColor = fillColor;
    this.label = label;
    this.fontSize = fontSize;
    this.minLength = strokeWidth;

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
    this.currentRect = new LabeledRect({
      left: this.currentStartX,
      top: this.currentStartY,
      originX: "left",
      originY: "top",
      width: this.minLength,
      height: this.minLength,
      stroke: this.strokeColor,
      strokeWidth: this.strokeWidth,
      fill: this.fillColor,
      label: this.label,
      fontSize: this.fontSize,
      transparentCorners: false,
      selectable: false,
      evented: false,
      strokeUniform: true,
      noScaleCache: false,
      angle: 0,
    });
    if (clicked === 0) {
      canvas.add(this.currentRect);
    }
  }

  private onMouseMove(o: TPointerEventInfo<TPointerEvent>) {
    if (!this.isMouseDown) return;
    const canvas = this.canvas;
    const pointer = canvas.getScenePoint(o.e);
    if (this.currentStartX > pointer.x) {
      this.currentRect.set({ left: Math.abs(pointer.x) });
    }
    if (this.currentStartY > pointer.y) {
      this.currentRect.set({ top: Math.abs(pointer.y) });
    }
    const width = Math.abs(this.currentStartX - pointer.x);
    const height = Math.abs(this.currentStartY - pointer.y);
    this.currentRect.set({
      width: Math.max(width, this.minLength * 2),
      height: Math.max(height, this.minLength * 2),
    });
    this.currentRect.setCoords();
    canvas.renderAll();
  }

  private onMouseUp() {
    this.isMouseDown = false;
  }

  private onMouseOut() {
    this.isMouseDown = false;
  }
}
