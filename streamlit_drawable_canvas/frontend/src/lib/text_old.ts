import { fabric } from "fabric";
import FabricTool, { ConfigureCanvasProps } from "./fabrictool";

// Extend ConfigureCanvasProps to include font-related properties
interface ExtendedConfigureCanvasProps extends ConfigureCanvasProps {
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: string;
  fontStyle?: "" | "normal" | "italic" | "oblique"; // Restrict to accepted values
}

// Load the Google Font (Luckiest Guy) via CSS
const loadGoogleFont = () => {
  const link = document.createElement("link");
  link.href = "https://fonts.googleapis.com/css2?family=Luckiest+Guy&display=swap";
  link.rel = "stylesheet";
  document.head.appendChild(link);
};

// Call the function to load the font
loadGoogleFont();

class TextTool extends FabricTool {
  isMouseDown: boolean = false;
  strokeWidth: number = 10;
  textColor: string = "#ffffff";
  fontFamily: string = "Luckiest Guy"; // Default font to Luckiest Guy
  fontSize: number = 20; // Default font size
  fontWeight: string = "normal"; // Default font weight
  fontStyle: "" | "normal" | "italic" | "oblique" = "normal"; // Default font style
  currentText: fabric.Textbox = new fabric.Textbox("");
  currentStartX: number = 0;
  currentStartY: number = 0;
  _minLength: number = 10;
  _minWidth: number = 10; // Minimum width for new text boxes
  _minHeight: number = 10; // Minimum height for new text boxes

  // Define the handleDelete method to remove the selected text object
  handleDelete = (e: KeyboardEvent) => {
    if (e.key === "Delete") {
      let activeObject = this._canvas.getActiveObject();
      if (activeObject && activeObject instanceof fabric.Textbox) {
        this._canvas.remove(activeObject);
        this._canvas.renderAll();
      }
    }
  };

  configureCanvas({
    strokeWidth,
    strokeColor,
    fontFamily,
    fontSize,
    fontWeight,
    fontStyle,
  }: ExtendedConfigureCanvasProps): () => void {
    this._canvas.isDrawingMode = false;
    this._canvas.selection = true; // Allow multiple objects to be selected
    this._canvas.forEachObject((o) => {
      o.selectable = true; // Enable selection of all objects
      o.evented = true; // Allow interaction with objects
    });

    this._minLength = strokeWidth;
    this.strokeWidth = strokeWidth;
    this.textColor = strokeColor;
    
    // Set default font properties if not provided
    this.fontFamily = fontFamily || "Luckiest Guy";
    this.fontSize = fontSize || 20;
    this.fontWeight = fontWeight || "normal";
    this.fontStyle = fontStyle || "normal"; // Default to a valid value
	

    // Set up event listeners for mouse events
    this._canvas.on("mouse:down", (e: any) => this.onMouseDown(e));
    this._canvas.on("mouse:move", (e: any) => this.onMouseMove(e));
    this._canvas.on("mouse:up", (e: any) => this.onMouseUp(e));
    this._canvas.on("mouse:out", (e: any) => this.onMouseOut(e));
    this._canvas.on("mouse:dblclick", (e: any) => this.onDoubleClick(e)); // Handle double-click

    // Add event listener for the Delete key
    window.addEventListener("keydown", this.handleDelete);

    return () => {
      this._canvas.off("mouse:down");
      this._canvas.off("mouse:move");
      this._canvas.off("mouse:up");
      this._canvas.off("mouse:out");
      this._canvas.off("mouse:dblclick");

      // Properly remove the handleDelete event listener
      window.removeEventListener("keydown", this.handleDelete);
    };
  }

  onMouseDown(o: any) {
    let canvas = this._canvas;
    var pointer = canvas.getPointer(o.e);
    var point = new fabric.Point(pointer.x, pointer.y);
    let objects = canvas.getObjects();

    // Check if the user clicked an existing text object
    let textObject = objects.find((obj) => {
      return obj instanceof fabric.Textbox && obj.containsPoint(point);
    }) as fabric.Textbox;

    if (textObject) {
      // Update the strokeWidth, textColor, fontFamily, etc. for the existing text object
      textObject.set({
        strokeWidth: this.strokeWidth,
        stroke: this.textColor,
        fill: "", // No fill, only outline
        fontFamily: this.fontFamily,
        fontSize: this.fontSize,
        fontWeight: this.fontWeight,
        fontStyle: this.fontStyle,
      });

      // Select the existing text object for moving/resizing
      this.currentText = textObject;
      canvas.setActiveObject(textObject);
      this.isMouseDown = true; // Allow resizing by keeping track of mouse down
      canvas.renderAll();
    } else {
      // If no text object is clicked, create a new one
      this.currentStartX = pointer.x;
      this.currentStartY = pointer.y;

      this.currentText = new fabric.Textbox("", {
        left: pointer.x,
        top: pointer.y,
        width: this._minWidth,
        height: this._minHeight,
        strokeWidth: this.strokeWidth,
        fill: "", // No fill, only outline
        stroke: this.textColor,
        fontFamily: this.fontFamily,
        fontSize: this.fontSize,
        fontWeight: this.fontWeight,
        fontStyle: this.fontStyle,
        originX: "left",
        originY: "top",
        selectable: true,
        editable: false,
        evented: true,
        hasControls: true,
        lockUniScaling: false,
        cornerColor: "blue",
        cornerSize: 10,
      });

      canvas.add(this.currentText);
      canvas.setActiveObject(this.currentText);
      this.isMouseDown = true;
      canvas.renderAll();
    }
  }

  onMouseMove(o: any) {
    if (!this.isMouseDown) return;
    let canvas = this._canvas;
    let pointer = canvas.getPointer(o.e);

    // Dynamically resize the selected text box (existing or new)
    let _width = Math.abs(this.currentStartX - pointer.x);
    let _height = Math.abs(this.currentStartY - pointer.y);

    // Ensure the width and height are above the minimum size
    this.currentText.set({
      width: Math.max(_width, this._minWidth),
      height: Math.max(_height, this._minHeight),
    });
    this.currentText.setCoords();
    canvas.renderAll();
  }

  onMouseUp(o: any) {
    this.isMouseDown = false;
  }

  onMouseOut(o: any) {
    this.isMouseDown = false;
  }

  // Double-click to enter text editing mode
  onDoubleClick(o: any) {
    let canvas = this._canvas;
    var pointer = canvas.getPointer(o.e);
    var point = new fabric.Point(pointer.x, pointer.y);
    let objects = canvas.getObjects();

    // Check if a text object was double-clicked
    let textObject = objects.find((obj) => {
      return obj instanceof fabric.Textbox && obj.containsPoint(point);
    }) as fabric.Textbox;

    // If a text object is double-clicked, enter text editing mode
    if (textObject) {
      textObject.set({ editable: true }); // Enable editing mode
      textObject.enterEditing();
      canvas.setActiveObject(textObject);
      canvas.renderAll();
    }
  }
}

export default TextTool;
