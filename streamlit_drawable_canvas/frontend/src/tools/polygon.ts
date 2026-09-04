import {
  Circle,
  Path,
  Polygon,
  TPointerEventInfo,
  TPointerEvent,
} from "fabric";
import { FabricTool, ConfigureCanvasProps } from "./fabrictool";
import { buildPathString, PolygonPoint } from "./polygon-path";

// A closed polygon needs at least a triangle -- clicking the first handle
// before then is not a valid close, so it's ignored.
const MIN_VERTICES_TO_CLOSE = 3;
const DRAW_HANDLE_RADIUS = 10;

export class PolygonTool extends FabricTool {
  private fillColor = "#ffffff";
  private strokeWidth = 10;
  private strokeColor = "#ffffff";
  private points: PolygonPoint[] = [];
  private handles: Circle[] = [];
  private currentPath: Path | null = null;
  private onPolygonClosed: () => void = () => {};

  configureCanvas({
    strokeWidth,
    strokeColor,
    fillColor,
    onPolygonClosed,
  }: ConfigureCanvasProps): () => void {
    this.canvas.isDrawingMode = false;
    this.canvas.selection = false;
    this.canvas.forEachObject((o) => (o.selectable = o.evented = false));

    this.strokeWidth = strokeWidth;
    this.strokeColor = strokeColor;
    this.fillColor = fillColor;
    this.onPolygonClosed = onPolygonClosed;
    this.points = [];
    this.handles = [];
    this.currentPath = null;

    const onMouseDown = (o: TPointerEventInfo<TPointerEvent>) =>
      this.onMouseDown(o);
    this.canvas.on("mouse:down", onMouseDown);
    return () => {
      this.canvas.off("mouse:down", onMouseDown);
      this.removeHandles();
    };
  }

  private onMouseDown(o: TPointerEventInfo<TPointerEvent>) {
    if ((o.e as MouseEvent).button !== 0) return;
    const handleIndex = this.handles.indexOf(o.target as Circle);

    if (handleIndex === 0) {
      if (this.points.length >= MIN_VERTICES_TO_CLOSE) this.close();
      return;
    }
    if (handleIndex > 0) {
      this.removeVertex(handleIndex);
      return;
    }

    const pointer = this.canvas.getScenePoint(o.e);
    this.addVertex(pointer);
  }

  private addVertex(pointer: PolygonPoint) {
    const handle = new Circle({
      left: pointer.x,
      top: pointer.y,
      originX: "center",
      originY: "center",
      radius: DRAW_HANDLE_RADIUS,
      fill: this.strokeColor,
      stroke: this.strokeColor,
      selectable: false,
      evented: true,
      hoverCursor: "pointer",
      // A bookkeeping handle, not part of the drawing -- must never appear
      // in json_data, unlike the in-progress path itself (see polygon.ts
      // header note in 0.12.0-spec.md).
      excludeFromExport: true,
    });
    this.points.push(pointer);
    this.handles.push(handle);
    this.canvas.add(handle);
    this.render();
  }

  private removeVertex(index: number) {
    this.canvas.remove(this.handles[index]);
    this.handles.splice(index, 1);
    this.points.splice(index, 1);
    this.render();
  }

  private close() {
    if (this.currentPath) this.canvas.remove(this.currentPath);
    this.removeHandles();
    // The closed shape is a Polygon, not a Path (0.12.0-spec.md §3.4.1):
    // `points` round-trips as data instead of an SVG command scan, and it's
    // what createPolyControls (point editing) requires.
    const polygon = new Polygon(this.points, {
      strokeWidth: this.strokeWidth,
      fill: this.fillColor,
      stroke: this.strokeColor,
      selectable: false,
      evented: false,
    });
    this.canvas.add(polygon);
    this.points = [];
    this.currentPath = null;
    this.onPolygonClosed();
  }

  private removeHandles() {
    this.handles.forEach((h) => this.canvas.remove(h));
    this.handles = [];
  }

  private render(closed = false) {
    const canvas = this.canvas;
    if (this.currentPath) canvas.remove(this.currentPath);
    this.currentPath =
      this.points.length >= 2
        ? new Path(buildPathString(this.points, closed), {
            strokeWidth: this.strokeWidth,
            fill: this.fillColor,
            stroke: this.strokeColor,
            originX: "center",
            originY: "center",
            selectable: false,
            evented: false,
          })
        : null;
    if (this.currentPath) canvas.add(this.currentPath);
    this.handles.forEach((h) => canvas.bringObjectToFront(h));
    canvas.renderAll();
  }
}
