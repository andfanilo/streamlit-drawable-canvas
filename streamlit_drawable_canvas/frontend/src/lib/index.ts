import PolypathTool from "./polypath"
import CircleTool from "./circle"
import FabricTool from "./fabrictool"
import FreedrawTool from "./freedraw"
import LineTool from "./line"
import RectTool from "./rect"
import TransformTool from "./transform"

// TODO: Should make TS happy on the Map of selectedTool --> FabricTool
const tools: any = {
  polypath: PolypathTool,
  circle: CircleTool,
  freedraw: FreedrawTool,
  line: LineTool,
  rect: RectTool,
  transform: TransformTool,
}

export { tools, FabricTool }
