import { FabricTool, ConfigureCanvasProps } from "./fabrictool";

export class EditTool extends FabricTool {
  configureCanvas(_args: ConfigureCanvasProps): () => void {
    const canvas = this.canvas;
    canvas.isDrawingMode = false;
    canvas.selection = true;
    canvas.forEachObject((o) => (o.selectable = o.evented = true));
    return () => {};
  }
}
