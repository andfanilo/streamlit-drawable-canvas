import FabricTool, { ConfigureCanvasProps } from "./fabrictool";
import { fabric } from "fabric";

class EmojiTool extends FabricTool {
  private selectedEmoji: string = "😊"; // Default emoji, can be changed through a UI element

  configureCanvas(args: ConfigureCanvasProps): () => void {
    let canvas = this._canvas;
    canvas.isDrawingMode = false;
    canvas.selection = false; // Disable selection when placing emojis

    // Handle click on canvas to place the selected emoji
    const handleCanvasClick = (options: fabric.IEvent) => {
      if (options.target) {
        return; // Do nothing if clicking on an existing object
      }
      const pointer = canvas.getPointer(options.e);
      this.addEmoji(pointer.x, pointer.y);
    };

    canvas.on('mouse:down', handleCanvasClick);

    return () => {
      canvas.off('mouse:down', handleCanvasClick);
    };
  }

  // Method to change the selected emoji
  public setSelectedEmoji(emoji: string) {
    this.selectedEmoji = emoji;
  }

  // Method to add an emoji to the canvas
  private addEmoji(x: number, y: number) {
    const emoji = new fabric.Text(this.selectedEmoji, {
      left: x,
      top: y,
      fontSize: 48, // Default size, can be made configurable
      selectable: true, // Allow moving around after placing
      evented: true, // Allow interaction after placing
    });
    this._canvas?.add(emoji);
    this._canvas?.renderAll();
  }
}

export default EmojiTool;
