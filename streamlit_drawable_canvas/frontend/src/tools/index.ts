import type { Canvas } from "fabric";
import { CircleTool } from "./circle";
import { FabricTool } from "./fabrictool";
import { FreedrawTool } from "./freedraw";
import { LineTool } from "./line";
import { PolygonTool } from "./polygon";
import { RectTool } from "./rect";
import { EditTool } from "./edit";
import { PointTool } from "./point";
import { TextTool } from "./text";
import { LabeledRectTool } from "./labeledrect";

export type FabricToolConstructor = new (canvas: Canvas) => FabricTool;

export const tools: Record<string, FabricToolConstructor> = {
  circle: CircleTool,
  freedraw: FreedrawTool,
  line: LineTool,
  polygon: PolygonTool,
  rect: RectTool,
  edit: EditTool,
  point: PointTool,
  text: TextTool,
  labeled_rect: LabeledRectTool,
};

export { FabricTool };
export type { ConfigureCanvasProps } from "./fabrictool";
