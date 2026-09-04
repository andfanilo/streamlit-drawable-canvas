import { IText, TPointerEventInfo, TPointerEvent } from "fabric";
import { FabricTool, ConfigureCanvasProps } from "./fabrictool";

export class TextTool extends FabricTool {
  private fillColor = "#000000";
  private fontSize = 20;
  private hiddenTextareaContainer: HTMLElement | null = null;

  configureCanvas({
    fillColor,
    fontSize,
    hiddenTextareaContainer,
  }: ConfigureCanvasProps): () => void {
    this.canvas.isDrawingMode = false;
    this.canvas.selection = false;
    this.canvas.forEachObject((o) => (o.selectable = o.evented = false));

    this.fillColor = fillColor;
    this.fontSize = fontSize;
    this.hiddenTextareaContainer = hiddenTextareaContainer;

    const onMouseDown = (o: TPointerEventInfo<TPointerEvent>) =>
      this.onMouseDown(o);
    this.canvas.on("mouse:down", onMouseDown);
    return () => {
      this.canvas.off("mouse:down", onMouseDown);
    };
  }

  private onMouseDown(o: TPointerEventInfo<TPointerEvent>) {
    if ((o.e as MouseEvent).button !== 0) return;
    const canvas = this.canvas;
    const pointer = canvas.getScenePoint(o.e);
    const text = new IText("", {
      left: pointer.x,
      top: pointer.y,
      fill: this.fillColor,
      fontSize: this.fontSize,
      hiddenTextareaContainer: this.hiddenTextareaContainer as HTMLElement,
    });
    canvas.add(text);
    canvas.setActiveObject(text);
    text.enterEditing();
  }
}
