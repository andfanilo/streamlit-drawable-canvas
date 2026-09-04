import { FabricImage, StaticCanvas } from "fabric";

export type BackgroundImageFit = "stretch" | "contain";

/** The applied background fit: the image occupies the canvas rectangle
 *  [offsetX, offsetY, naturalWidth*scaleX, naturalHeight*scaleY]. */
export interface BackgroundFit {
  naturalWidth: number;
  naturalHeight: number;
  scaleX: number;
  scaleY: number;
  offsetX: number;
  offsetY: number;
}

const fitToCanvas = (
  backgroundCanvas: StaticCanvas,
  img: FabricImage,
  fit: BackgroundImageFit
): BackgroundFit => {
  const canvasWidth = backgroundCanvas.width ?? img.width;
  const canvasHeight = backgroundCanvas.height ?? img.height;

  if (fit === "contain") {
    const scale = Math.min(canvasWidth / img.width, canvasHeight / img.height);
    const offsetX = (canvasWidth - img.width * scale) / 2;
    const offsetY = (canvasHeight - img.height * scale) / 2;
    img.set({
      left: offsetX,
      top: offsetY,
      originX: "left",
      originY: "top",
      scaleX: scale,
      scaleY: scale,
    });
    return {
      naturalWidth: img.width,
      naturalHeight: img.height,
      scaleX: scale,
      scaleY: scale,
      offsetX,
      offsetY,
    };
  }

  const scaleX = canvasWidth / img.width;
  const scaleY = canvasHeight / img.height;
  img.set({
    left: 0,
    top: 0,
    originX: "left",
    originY: "top",
    scaleX,
    scaleY,
  });
  return {
    naturalWidth: img.width,
    naturalHeight: img.height,
    scaleX,
    scaleY,
    offsetX: 0,
    offsetY: 0,
  };
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
): Promise<BackgroundFit | null> => {
  if (!url) {
    backgroundCanvas.backgroundImage = undefined;
    backgroundCanvas.renderAll();
    return null;
  }

  const img = await FabricImage.fromURL(url);
  if (!generationCheck()) {
    return null;
  }
  const appliedFit = fitToCanvas(backgroundCanvas, img, fit);
  backgroundCanvas.backgroundImage = img;
  backgroundCanvas.renderAll();
  return appliedFit;
};

/** Re-fit the already-loaded background image after a canvas resize, or a
 *  change of fit mode. Does not re-fetch. */
export const rescaleBackgroundImage = (
  backgroundCanvas: StaticCanvas,
  fit: BackgroundImageFit
): BackgroundFit | null => {
  const img = backgroundCanvas.backgroundImage;
  if (!img) return null;
  const appliedFit = fitToCanvas(backgroundCanvas, img as FabricImage, fit);
  backgroundCanvas.renderAll();
  return appliedFit;
};
