import { FabricImage, StaticCanvas } from "fabric";

export type BackgroundImageFit = "stretch" | "contain";

const fitToCanvas = (
  backgroundCanvas: StaticCanvas,
  img: FabricImage,
  fit: BackgroundImageFit
): void => {
  const canvasWidth = backgroundCanvas.width ?? img.width;
  const canvasHeight = backgroundCanvas.height ?? img.height;

  if (fit === "contain") {
    const scale = Math.min(canvasWidth / img.width, canvasHeight / img.height);
    img.set({
      left: (canvasWidth - img.width * scale) / 2,
      top: (canvasHeight - img.height * scale) / 2,
      originX: "left",
      originY: "top",
      scaleX: scale,
      scaleY: scale,
    });
    return;
  }

  img.set({
    left: 0,
    top: 0,
    originX: "left",
    originY: "top",
    scaleX: canvasWidth / img.width,
    scaleY: canvasHeight / img.height,
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
  generationCheck: () => boolean,
  fit: BackgroundImageFit
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
  fitToCanvas(backgroundCanvas, img, fit);
  backgroundCanvas.backgroundImage = img;
  backgroundCanvas.renderAll();
};

/** Re-fit the already-loaded background image after a canvas resize, or a
 *  change of fit mode. Does not re-fetch. */
export const rescaleBackgroundImage = (
  backgroundCanvas: StaticCanvas,
  fit: BackgroundImageFit
): void => {
  const img = backgroundCanvas.backgroundImage;
  if (!img) return;
  fitToCanvas(backgroundCanvas, img as FabricImage, fit);
  backgroundCanvas.renderAll();
};
