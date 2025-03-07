import CircleTool from "./circle"
import FabricTool from "./fabrictool"
import FreedrawTool from "./freedraw"
import LineTool from "./line"
import PolygonTool from "./polygon"
import RectTool from "./rect"
import TransformTool from "./transform"
import PointTool from "./point"
import TextTool from "./text";
import EmojiTool from "./emoji";
import ImageTool from './imagetool'; // Import the ImageTool
import EraserTool from './eraser'; // Import the ImageTool




// TODO: Should make TS happy on the Map of selectedTool --> FabricTool
const tools: any = {
  circle: CircleTool,
  freedraw: FreedrawTool,
  line: LineTool,
  polygon: PolygonTool,
  rect: RectTool,
  transform: TransformTool,
  point: PointTool,
  text: TextTool,
  emoji: EmojiTool,
  image: ImageTool,
  eraser: EraserTool,
}

export { tools, FabricTool }
