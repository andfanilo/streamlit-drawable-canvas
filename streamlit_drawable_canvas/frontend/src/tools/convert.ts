// Fabric-facing conversion to Polygon (0.12.0-spec.md §3.4.2-§3.4.4).
import { Canvas, Path, Polygon, Rect, util } from "fabric";
import { LOCK_PROPERTIES } from "./lockProperties";
import {
  applyMatrix2,
  boxCorners,
  pathCommandsToPoints,
  Point2D,
} from "./geometry";

const COPIED_PROPERTIES = [
  "fill",
  "stroke",
  "strokeWidth",
  "strokeUniform",
  "strokeDashArray",
  "opacity",
  "flipX",
  "flipY",
  "visible",
  "globalCompositeOperation",
  "shadow",
  "selectable",
  "evented",
] as const;

const localPointsOf = (source: Rect | Path): Point2D[] | null => {
  if (source instanceof Rect) return boxCorners(source.width, source.height);
  const points = pathCommandsToPoints(source.path as unknown[]);
  if (!points) return null;
  const { x: ox, y: oy } = source.pathOffset;
  return points.map((p) => ({ x: p.x - ox, y: p.y - oy }));
};

/** Bakes `source`'s scale/skew into absolute points and swaps it in place for
 *  an equivalent `Polygon`, preserving centre, angle and z-order (§3.4.4).
 *  Returns `null` when `source` is a `Path` that isn't a closed M/L polygon. */
export const toPolygon = (
  canvas: Canvas,
  source: Rect | Path
): Polygon | null => {
  const localPoints = localPointsOf(source);
  if (!localPoints) return null;

  const { angle, scaleX, scaleY, skewX, skewY } = util.qrDecompose(
    source.calcOwnMatrix()
  );
  const m = util.composeMatrix({ angle: 0, scaleX, scaleY, skewX, skewY });
  const points = applyMatrix2(localPoints, [m[0], m[1], m[2], m[3]]);

  const options: Record<string, unknown> = {
    angle,
    scaleX: 1,
    scaleY: 1,
    skewX: 0,
    skewY: 0,
  };
  const src = source as unknown as Record<string, unknown>;
  for (const key of COPIED_PROPERTIES) options[key] = src[key];
  for (const key of LOCK_PROPERTIES) options[key] = src[key];

  const polygon = new Polygon(points, options);
  polygon.setPositionByOrigin(source.getCenterPoint(), "center", "center");

  const index = canvas.getObjects().indexOf(source);
  canvas.remove(source);
  canvas.insertAt(index, polygon);
  return polygon;
};

/** A closed M/L Path qualifies as a legacy polygon: every command is M/L/Z
 *  (case-insensitive), it is closed, and it has at least 3 vertices (§3.4.2).
 *  Converts every qualifying Path on `canvas` to a `Polygon` in place. Call
 *  after `loadFromJSON` resolves and before the canvas renders or its state
 *  is snapshotted. Returns whether anything was converted, so a caller can
 *  decide whether the resulting payload differs from what it loaded. */
export const convertLegacyPolygons = (canvas: Canvas): boolean => {
  let converted = false;
  for (const object of canvas.getObjects()) {
    if (object instanceof Path && toPolygon(canvas, object)) converted = true;
  }
  return converted;
};
