import { FabricImage, StaticCanvas } from "fabric";

const fitToCanvas = (
  backgroundCanvas: StaticCanvas,
  img: FabricImage
): void => {
  img.set({
    left: 0,
    top: 0,
    originX: "left",
    originY: "top",
    scaleX: (backgroundCanvas.width ?? img.width) / img.width,
    scaleY: (backgroundCanvas.height ?? img.height) / img.height,
  });
};

/**
 * Draw (or clear) the background image layer, scaled to fill the canvas.
 * `url` is either an http(s) URL or a data: URI. `generationCheck` returns
 * false if a newer background arrived while this one was loading.
 */
export const applyBackgroundImage = async (
  backgroundCanvas: StaticCanvas,
  url: string | null,
  generationCheck: () => boolean
): Promise<void> => {
  if (!url) {
    backgroundCanvas.backgroundImage = undefined;
    backgroundCanvas.renderAll();
    return;
  }

  const img = await FabricImage.fromURL(url);
  if (!generationCheck()) {
    return;
  }
  fitToCanvas(backgroundCanvas, img);
  backgroundCanvas.backgroundImage = img;
  backgroundCanvas.renderAll();
};

/** Re-fit the already-loaded background image after a canvas resize. */
export const rescaleBackgroundImage = (
  backgroundCanvas: StaticCanvas
): void => {
  const img = backgroundCanvas.backgroundImage;
  if (!img) return;
  fitToCanvas(backgroundCanvas, img as FabricImage);
  backgroundCanvas.renderAll();
};
