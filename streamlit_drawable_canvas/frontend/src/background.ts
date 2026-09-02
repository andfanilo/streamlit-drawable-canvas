import { FabricImage, StaticCanvas } from "fabric";

/**
 * Draw (or clear) the background image layer. Memoized by the caller against
 * the last-applied URL so an unrelated rerun doesn't reload the image.
 *
 * The frontend receives a plain URL string -- either an ordinary http(s) URL
 * or a data: URI -- and doesn't care which. The image is scaled to fill the
 * canvas dimensions, matching the documented `background_image` behaviour.
 *
 * Uses Fabric's own `backgroundImage` + `renderAll()`, not raw
 * `ctx.drawImage`: `StaticCanvas` owns and re-renders this canvas element
 * from its own object model (background image included), so anything drawn
 * by reaching past that API gets silently wiped on the next Fabric-driven
 * render.
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
    // A newer background_image arrived while this one was loading.
    return;
  }
  const canvasWidth = backgroundCanvas.width ?? img.width;
  const canvasHeight = backgroundCanvas.height ?? img.height;
  img.set({
    left: 0,
    top: 0,
    originX: "left",
    originY: "top",
    scaleX: canvasWidth / img.width,
    scaleY: canvasHeight / img.height,
  });
  backgroundCanvas.backgroundImage = img;
  backgroundCanvas.renderAll();
};
