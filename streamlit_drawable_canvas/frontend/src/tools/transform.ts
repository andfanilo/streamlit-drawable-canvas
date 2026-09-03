import { FabricTool, ConfigureCanvasProps } from "./fabrictool";

export class TransformTool extends FabricTool {
  configureCanvas(_args: ConfigureCanvasProps): () => void {
    const canvas = this.canvas;
    canvas.isDrawingMode = false;
    canvas.selection = true;
    canvas.forEachObject((o) => (o.selectable = o.evented = true));

    // Instead of looking for the target of the double click, assume a
    // double click on an object clears the selected object.
    const handleDoubleClick = () => {
      const active = canvas.getActiveObject();
      if (active) {
        canvas.remove(active);
      }
    };

    canvas.on("mouse:dblclick", handleDoubleClick);
    return () => {
      canvas.off("mouse:dblclick", handleDoubleClick);
    };
  }
}
