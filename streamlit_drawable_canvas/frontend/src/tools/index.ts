import type { Canvas } from "fabric";
import { CircleTool } from "./circle";
import { FabricTool } from "./fabrictool";
import { FreedrawTool } from "./freedraw";
import { LineTool } from "./line";
import { PolygonTool } from "./polygon";
import { RectTool } from "./rect";
import { TransformTool } from "./transform";
import { PointTool } from "./point";

export type FabricToolConstructor = new (canvas: Canvas) => FabricTool;

export const tools: Record<string, FabricToolConstructor> = {
  circle: CircleTool,
  freedraw: FreedrawTool,
  line: LineTool,
  polygon: PolygonTool,
  rect: RectTool,
  transform: TransformTool,
  point: PointTool,
};

export { FabricTool };
export type { ConfigureCanvasProps } from "./fabrictool";
