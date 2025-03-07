import { fabric } from "fabric";
import FabricTool, { ConfigureCanvasProps } from "./fabrictool";

// Remove this line because it's causing an empty class warning and is not needed
fabric.Textbox.prototype._wordJoiners = /[]/;

// Extend ConfigureCanvasProps to include font-related properties
interface ExtendedConfigureCanvasProps extends ConfigureCanvasProps {
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: string;
  fontStyle?: "" | "normal" | "italic" | "oblique"; // Restrict to accepted values
}

// Load fonts from local `fonts` directory dynamically
const loadLocalFonts = () => {
  const fonts = [
    { name: 'AoboshiOne-Regular', path: 'fonts/AoboshiOne-Regular.ttf' },
    { name: 'DelaGothicOne-Regular', path: 'fonts/DelaGothicOne-Regular.ttf' },
    { name: 'Lora-Bold', path: 'fonts/Lora-Bold.ttf' },
    { name: 'Merriweather-Bold', path: 'fonts/Merriweather-Bold.ttf' },
    { name: 'NotoSansJP-ExtraBold', path: 'fonts/NotoSansJP-ExtraBold.ttf' },
    { name: 'OpenSans-Bold', path: 'fonts/OpenSans-Bold.ttf' },
    { name: 'Poppins-Bold', path: 'fonts/Poppins-Bold.ttf' },
    { name: 'RampartOne-Regular', path: 'fonts/RampartOne-Regular.ttf' },
    { name: 'ReggaeOne-Regular', path: 'fonts/ReggaeOne-Regular.ttf' },
    { name: 'Roboto-Bold', path: 'fonts/Roboto-Bold.ttf' },
  ];

  fonts.forEach(font => {
    const style = document.createElement('style');
    style.innerHTML = `
      @font-face {
        font-family: '${font.name}';
        src: url('${font.path}');
      }
    `;
    document.head.appendChild(style);
  });
};

// Call the function to load the fonts
loadLocalFonts();

// Load the Google Font (Luckiest Guy) via CSS
const loadGoogleFont = () => {
  const link = document.createElement("link");
  link.href = "https://fonts.googleapis.com/css2?family=Luckiest+Guy&display=swap";
  link.rel = "stylesheet";
  document.head.appendChild(link);
};

// Call the function to load the Google font
loadGoogleFont();

class TextTool extends FabricTool {
  isMouseDown: boolean = false;
  isCreatingNewTextbox: boolean = false; // Flag to track whether we are creating a new textbox
  isResizing: boolean = false; // New flag to track if we are resizing
  strokeWidth: number = 10;
  textColor: string = "#ffffff";
  fontFamily: string = "Luckiest Guy"; // Default font to Luckiest Guy
  fontSize: number = 20; // Default font size
  fontWeight: string = "normal"; // Default font weight
  fontStyle: "" | "normal" | "italic" | "oblique" = "normal"; // Default font style
  currentText: fabric.Textbox | null = null; // Set currentText to null initially
  currentStartX: number = 0;
  currentStartY: number = 0;
  _minWidth: number = 10; // Minimum width for new text boxes
  _minHeight: number = 10; // Minimum height for new text boxes

  handleDelete = (e: KeyboardEvent) => {
    if (e.key === "Delete") {
      let activeObject = this._canvas.getActiveObject();
      if (activeObject && activeObject instanceof fabric.Textbox) {
        this._canvas.remove(activeObject);
        this._canvas.renderAll();
      }
    }
  };

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
    this.fontFamily = fontFamily || this.fontFamily;
    this.fontSize = fontSize || 20;
    this.fontWeight = fontWeight || "normal";
    this.fontStyle = fontStyle || "normal"; // Default to a valid value

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
    this._canvas.on("mouse:dblclick", (e: any) => this.onDoubleClick(e));

    window.addEventListener("keydown", this.handleDelete);
    window.addEventListener("keydown", this.handleArrowKeys);

    return () => {
      this._canvas.off("mouse:down");
      this._canvas.off("mouse:move");
      this._canvas.off("mouse:up");
      this._canvas.off("mouse:out");
      this._canvas.off("mouse:dblclick");

      window.removeEventListener("keydown", this.handleDelete);
      window.removeEventListener("keydown", this.handleArrowKeys);
    };
  }

  // Handle mouse down event
  onMouseDown(o: any) {
    let canvas = this._canvas;
    var pointer = canvas.getPointer(o.e);
    var point = new fabric.Point(pointer.x, pointer.y);
    let objects = canvas.getObjects();

    // Check if the user clicked an existing text object
    let textObject = objects.find((obj) => {
      return obj instanceof fabric.Textbox && obj.containsPoint(point);
    }) as fabric.Textbox;

    // If resizing, set isResizing to true and avoid creating a new textbox
    if (this._canvas.getActiveObject() && this._canvas.getActiveObject() instanceof fabric.Textbox) {
      this.isResizing = true; // We are resizing, no new textboxes
      this.isMouseDown = true;
      return; // Prevent new textbox creation
    }

    // Before creating a new textbox, remove the current one if it's empty
    if (this.currentText && typeof this.currentText.text === 'string' && this.currentText.text.trim() === "") {
      this._canvas.remove(this.currentText);
    }

    if (textObject) {
      // If a text object was clicked, select and move/resize it
      this.currentText = textObject;
      this.isMouseDown = true;
      this.isCreatingNewTextbox = false; // We're interacting with an existing text box
      canvas.setActiveObject(textObject);
      canvas.renderAll();
    } else {
      // If no text object was clicked, proceed to create a new text box
      this.currentStartX = pointer.x;
      this.currentStartY = pointer.y;
      this.isCreatingNewTextbox = true; // Set flag for creating a new text box

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
      canvas.setActiveObject(this.currentText);
      this.currentText.enterEditing(); // Enter editing mode immediately
      this.isMouseDown = true;
      canvas.renderAll();
    }
  }

  onMouseMove(o: any) {
    if (!this.isMouseDown) return;

    let canvas = this._canvas;
    let pointer = canvas.getPointer(o.e);

    // Prevent new textbox creation while resizing
    if (this.isResizing) {
      return;
    }

    // Only resize if we're in the process of creating a new text box
    if (this.isCreatingNewTextbox && this.currentText) {
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
  }

  onMouseUp(o: any) {
    // Reset flags after mouse action is complete
    this.isMouseDown = false;
    this.isCreatingNewTextbox = false; // Ensure flag is reset
    this.isResizing = false; // Reset resizing flag
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

    let textObject = objects.find((obj) => {
      return obj instanceof fabric.Textbox && obj.containsPoint(point);
    }) as fabric.Textbox;

    if (textObject) {
      textObject.set({ editable: true }); // Enable editing mode
      textObject.enterEditing();
      canvas.setActiveObject(textObject);

      textObject.on("changed", () => {
        this._resizeTextBoxToFitText(textObject);
      });

      this._resizeTextBoxToFitText(textObject); // Resize the text box to fit the text dynamically
      canvas.renderAll();
    }
  }

  _resizeTextBoxToFitText(textbox: fabric.Textbox) {
    const { left, top } = textbox;

    const textLinesMaxWidth = textbox.textLines.reduce(
      (max, _, i) => Math.max(max, textbox.getLineWidth(i)),
      0
    );

    textbox.set({
      width: textLinesMaxWidth,
      left,
      top,
    });

    textbox.setCoords();
    this._canvas.renderAll();
  }
}

export default TextTool;
