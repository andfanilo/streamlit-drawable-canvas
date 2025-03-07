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

  // Handle keyboard arrow keys for moving selected text box
  handleArrowKeys = (e: KeyboardEvent) => {
    let activeObject = this._canvas.getActiveObject();
    if (activeObject && activeObject instanceof fabric.Textbox) {
      switch (e.key) {
        case "ArrowUp":
          activeObject.top = (activeObject.top || 0) - 5; // Move up by 5 pixels
          break;
        case "ArrowDown":
          activeObject.top = (activeObject.top || 0) + 5; // Move down by 5 pixels
          break;
        case "ArrowLeft":
          activeObject.left = (activeObject.left || 0) - 5; // Move left by 5 pixels
          break;
        case "ArrowRight":
          activeObject.left = (activeObject.left || 0) + 5; // Move right by 5 pixels
          break;
        default:
          return; // If not an arrow key, ignore the event
      }
      activeObject.setCoords();
      this._canvas.renderAll(); // Re-render the canvas after moving the object
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

    this.strokeWidth = strokeWidth;
    this.textColor = strokeColor;

    // Set default font properties if not provided
    this.fontFamily = fontFamily || "Luckiest Guy";
    this.fontSize = fontSize || 20;
    this.fontWeight = fontWeight || "normal";
    this.fontStyle = fontStyle || "normal"; // Default to a valid value

    // Check if a text object is actively being edited and update its properties
    const activeObject = this._canvas.getActiveObject();
    if (activeObject && activeObject instanceof fabric.Textbox && activeObject.isEditing) {
      activeObject.set({
        strokeWidth: this.strokeWidth,
        stroke: this.textColor,
        fontFamily: this.fontFamily,
        fontSize: this.fontSize,
        fontWeight: this.fontWeight,
        fontStyle: this.fontStyle,
      });
      this._resizeTextBoxToFitText(activeObject); // Ensure the text box resizes to fit the text
      this._canvas.renderAll();
    }

    // Set up event listeners for mouse events
    this._canvas.on("mouse:down", (e: any) => this.onMouseDown(e));
    this._canvas.on("mouse:move", (e: any) => this.onMouseMove(e));
    this._canvas.on("mouse:up", (e: any) => this.onMouseUp(e));
    this._canvas.on("mouse:out", (e: any) => this.onMouseOut(e));
    this._canvas.on("mouse:dblclick", (e: any) => this.onDoubleClick(e)); // Handle double-click

    // Add event listeners for the Delete key and Arrow keys
    window.addEventListener("keydown", this.handleDelete);
    window.addEventListener("keydown", this.handleArrowKeys);

    return () => {
      this._canvas.off("mouse:down");
      this._canvas.off("mouse:move");
      this._canvas.off("mouse:up");
      this._canvas.off("mouse:out");
      this._canvas.off("mouse:dblclick");

      // Properly remove the handleDelete and handleArrowKeys event listeners
      window.removeEventListener("keydown", this.handleDelete);
      window.removeEventListener("keydown", this.handleArrowKeys);
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
      this._resizeTextBoxToFitText(this.currentText); // Resize the box to fit the text
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
        editable: true, // Enable editing on click
        evented: true,
        hasControls: true,
        lockUniScaling: false,
        cornerColor: "blue",
        cornerSize: 10,
      });

      canvas.add(this.currentText);
      this._resizeTextBoxToFitText(this.currentText); // Ensure the box fits the text
      canvas.setActiveObject(this.currentText);
      this.currentText.enterEditing(); // Enter editing mode immediately
      this.isMouseDown = true;
      canvas.renderAll();
    }
  }

  // Ensure the Textbox resizes according to the text, maintaining its current position
  _resizeTextBoxToFitText(textbox: fabric.Textbox) {
    // Save current position before resizing
    const { left, top } = textbox;

    // Calculate text width
    const textWidth = this._calculateTextWidth(textbox);

    // Set new width while maintaining the original position
    textbox.set({
      width: textWidth,
      height: this._minHeight, // Keep height constant or adjust accordingly
      left, // Maintain original position
      top,  // Maintain original position
    });

    textbox.setCoords();
    this._canvas.renderAll();
  }

  // Function to calculate text width
  _calculateTextWidth(textbox: fabric.Textbox): number {
    const ctx = this._canvas.getContext(); // Get canvas context
    ctx.font = `${textbox.fontWeight} ${textbox.fontSize}px ${textbox.fontFamily}`;
    const textWidth = ctx.measureText(textbox.text || '').width; // Measure text width
    return textWidth;
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
      this._resizeTextBoxToFitText(textObject); // Resize the text box to fit the text dynamically
      canvas.renderAll();
    }
  }
}

export default TextTool;