import { Circle, Line, Path, TPointerEventInfo, TPointerEvent } from "fabric";
import { FabricTool, ConfigureCanvasProps } from "./fabrictool";

export class PolygonTool extends FabricTool {
  private isMouseDown = false;
  private fillColor = "#ffffff";
  private strokeWidth = 10;
  private strokeColor = "#ffffff";
  private startCircle: Circle = new Circle();
  private currentLine: Line = new Line();
  private currentPath: Path = new Path("M 0 0");
  private pathString = "M ";

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

    const onMouseDown = (o: TPointerEventInfo<TPointerEvent>) =>
      this.onMouseDown(o);
    const onMouseMove = (o: TPointerEventInfo<TPointerEvent>) =>
      this.onMouseMove(o);
    const onMouseUp = () => this.onMouseUp();
    const onMouseOut = () => this.onMouseOut();
    const onMouseDoubleClick = () => this.onMouseDoubleClick();

    this.canvas.on("mouse:down", onMouseDown);
    this.canvas.on("mouse:move", onMouseMove);
    this.canvas.on("mouse:up", onMouseUp);
    this.canvas.on("mouse:out", onMouseOut);
    this.canvas.on("mouse:dblclick", onMouseDoubleClick);
    return () => {
      this.canvas.off("mouse:down", onMouseDown);
      this.canvas.off("mouse:move", onMouseMove);
      this.canvas.off("mouse:up", onMouseUp);
      this.canvas.off("mouse:out", onMouseOut);
      this.canvas.off("mouse:dblclick", onMouseDoubleClick);
    };
  }

  private onMouseDown(o: TPointerEventInfo<TPointerEvent>) {
    const canvas = this.canvas;
    const clicked = (o.e as MouseEvent).button;
    let start = this.pathString === "M ";

    this.isMouseDown = true;
    const pointer = canvas.getScenePoint(o.e);

    canvas.remove(this.currentLine);
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

    if (start && clicked === 0) {
      // Initialize pathString
      this.pathString += `${pointer.x} ${pointer.y} `;
      this.startCircle = new Circle({
        left: pointer.x,
        top: pointer.y,
        originX: "center",
        originY: "center",
        strokeWidth: this.strokeWidth,
        stroke: this.strokeColor,
        fill: this.strokeColor,
        selectable: false,
        evented: false,
        radius: this.strokeWidth,
      });
      canvas.add(this.startCircle);

      start = false;
    } else {
      canvas.remove(this.currentPath);
      if (clicked === 0) {
        // Update pathString
        this.pathString += `L ${pointer.x} ${pointer.y} `;
      }
      if (clicked === 2) {
        // Close pathString
        this.pathString += "z";
        canvas.remove(this.startCircle);
      }
    }
    this.currentPath = new Path(this.pathString, {
      strokeWidth: this.strokeWidth,
      fill: this.fillColor,
      stroke: this.strokeColor,
      originX: "center",
      originY: "center",
      selectable: false,
      evented: false,
    });
    if (this.currentPath.width !== 0 && this.currentPath.height !== 0) {
      canvas.add(this.currentPath);
    }
    if (clicked === 2) {
      this.pathString = "M ";
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
    this.isMouseDown = true;
  }

  private onMouseOut() {
    this.isMouseDown = false;
  }

  private onMouseDoubleClick() {
    const canvas = this.canvas;
    // Double click adds two more points at the end, so we have to move back twice more...
    for (let i = 0; i < 3; i++) {
      const lastPtIdx = this.pathString.lastIndexOf("L");
      if (lastPtIdx === -1) {
        this.pathString = "M ";
        canvas.remove(this.startCircle);
      } else {
        this.pathString = this.pathString.slice(0, lastPtIdx);
      }
    }

    canvas.remove(this.currentLine);
    canvas.remove(this.currentPath);
    this.currentPath = new Path(this.pathString, {
      strokeWidth: this.strokeWidth,
      fill: this.fillColor,
      stroke: this.strokeColor,
      originX: "center",
      originY: "center",
      selectable: false,
      evented: false,
    });
    canvas.add(this.currentPath);
  }
}
