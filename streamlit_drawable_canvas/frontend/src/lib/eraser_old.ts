import { fabric } from "fabric"; // Import fabric as a module
import FabricTool, { ConfigureCanvasProps } from "./fabrictool";

// Define the ErasedGroup class properly
const ErasedGroup = fabric.util.createClass(fabric.Group, {
  initialize: function (original: fabric.Object[], erasedPath: fabric.Path, options: any) {
    this.original = original;
    this.erasedPath = erasedPath;
    this.callSuper("initialize", [this.original, this.erasedPath], options);
  },

  _calcBounds: function (onlyWidthHeight: boolean) {
    const aX: number[] = [],
      aY: number[] = [],
      props = ["tr", "br", "bl", "tl"],
      jLen = props.length,
      ignoreZoom = true;

    let o = this.original;
    o.setCoords(ignoreZoom);
    for (let j = 0; j < jLen; j++) {
      const prop = props[j];
      aX.push(o.oCoords[prop].x);
      aY.push(o.oCoords[prop].y);
    }

    this._getBounds(aX, aY, onlyWidthHeight);
  },
});

class EraserTool extends FabricTool {
  configureCanvas({
    strokeWidth,
  }: ConfigureCanvasProps): () => void {
  
    
    // Set the eraser functionality using a custom EraserBrush
    const EraserBrush = fabric.util.createClass(fabric.PencilBrush, {
	
	
      _finalizeAndAddPath: function () {
        var ctx = this.canvas.contextTop;
        ctx.closePath();
        if (this.decimate) {
          this._points = this.decimatePoints(this._points, this.decimate);
        }
        var pathData = this.convertPointsToSVGPath(this._points).join("");
        if (pathData === "M 0 0 Q 0 0 0 0 L 0 0") {
          this.canvas.requestRenderAll();
          return;
        }

        var path = this.createPath(pathData);
        path.globalCompositeOperation = "destination-out";
        path.selectable = false;
        path.evented = false;
        path.absolutePositioned = true;

        const objects = this.canvas.getObjects().filter((obj: fabric.Object) =>
          obj.intersectsWithObject(path)
        );

        if (objects.length > 0) {
          const mergedGroup = new fabric.Group(objects);

          // Create a new ErasedGroup instance
          const newPath = new ErasedGroup(mergedGroup, path, {});

          const left = newPath.left;
          const top = newPath.top;
          const newData = newPath.toDataURL({ withoutTransform: true });

          fabric.Image.fromURL(newData, (fabricImage) => {
            fabricImage.set({
              left: left,
              top: top,
            });
            this.canvas.remove(...objects);
            this.canvas.add(fabricImage);
			this.canvas.renderAll()
          });
        }

        this.canvas.clearContext(this.canvas.contextTop);
        this.canvas.renderAll();
        this._resetShadow();
      },
    });

    const eraserBrush = new EraserBrush(this._canvas);
    eraserBrush.width = strokeWidth;
    this._canvas.freeDrawingBrush = eraserBrush;
    this._canvas.isDrawingMode = true;
	this._canvas.freeDrawingBrush.color = 'rgba(255, 255, 255, 1)';
	eraserBrush.color = 'rgba(255, 255, 255, 1)';

	
	

    return () => {};
  }
}

export default EraserTool;
