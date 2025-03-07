import { fabric } from "fabric";
import FabricTool, { ConfigureCanvasProps } from "./fabrictool";

class ImageTool extends FabricTool {
  // Handle deleting the selected image
  handleDelete = (e: KeyboardEvent) => {
    if (e.key === "Delete") {
      let activeObject = this._canvas.getActiveObject();
      if (activeObject && activeObject instanceof fabric.Image) {
        this._canvas.remove(activeObject);
        this._canvas.renderAll();
      }
    }
  };

  // Handle arrow keys for moving the selected image
  handleArrowKeys = (e: KeyboardEvent) => {
    let activeObject = this._canvas.getActiveObject();
    if (activeObject && activeObject instanceof fabric.Image) {
      switch (e.key) {
        case "ArrowUp":
          activeObject.top = (activeObject.top || 0) - 5;
          break;
        case "ArrowDown":
          activeObject.top = (activeObject.top || 0) + 5;
          break;
        case "ArrowLeft":
          activeObject.left = (activeObject.left || 0) - 5;
          break;
        case "ArrowRight":
          activeObject.left = (activeObject.left || 0) + 5;
          break;
        default:
          return;
      }
      activeObject.setCoords();
      this._canvas.renderAll();
    }
  };

  configureCanvas({}: ConfigureCanvasProps): () => void {
    this._canvas.isDrawingMode = false;
    this._canvas.selection = false;
    this._canvas.forEachObject((o) => {
      o.selectable = true;
      o.evented = true;
    });

    // Set up event listener for mouse down event
    this._canvas.on("mouse:down", (e: fabric.IEvent) => this.onMouseDown(e));

    // Add event listeners for the Delete key and Arrow keys
    window.addEventListener("keydown", this.handleDelete);
    window.addEventListener("keydown", this.handleArrowKeys);

    return () => {
      this._canvas.off("mouse:down");

      window.removeEventListener("keydown", this.handleDelete);
      window.removeEventListener("keydown", this.handleArrowKeys);
    };
  }

  onMouseDown(e: fabric.IEvent) {
    // Ensure that the native event is available
    const nativeEvent = e.e as MouseEvent;
    if (!nativeEvent) return;

    // Only proceed if the left mouse button is pressed
    if (nativeEvent.button !== 0) return;

    // If an object was clicked, do nothing
    if (e.target) {
      // Fabric.js will handle object selection and transformation
      return;
    }

    let canvas = this._canvas;
    var pointer = canvas.getPointer(nativeEvent);

    // Initiate adding a new image
    this._promptForImageFile(pointer.x, pointer.y);
  }

  _promptForImageFile(x: number, y: number) {
    const inputElement = document.createElement("input");
    inputElement.type = "file";
    inputElement.accept = "image/*";
    inputElement.style.display = "none";

    inputElement.addEventListener("change", (event: any) => {
      const file = event.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (f: any) => {
          const data = f.target.result;
          fabric.Image.fromURL(
            data,
            (img) => {
              img.set({
                left: x,
                top: y,
                selectable: true,
                hasControls: true,
                lockUniScaling: false,
                cornerColor: "blue",
                cornerSize: 10,
              });

              // Do not scale the image; use its natural size

              this._canvas.add(img);
              // Do not set the image as the active object
              // this._canvas.setActiveObject(img);
              this._canvas.renderAll();
            },
            { crossOrigin: "anonymous" }
          );
        };
        reader.readAsDataURL(file);
      }
    });

    document.body.appendChild(inputElement);
    inputElement.click();
    document.body.removeChild(inputElement);
  }
}

export default ImageTool;
