// Pure vertex-array -> SVG path-string derivation for the polygon tool. No
// Fabric or DOM dependency, so Vitest can exercise it directly.

export interface PolygonPoint {
  x: number;
  y: number;
}

/** Derives an SVG path string from an ordered list of vertices: a single
 *  `M` for the first point, an `L` per remaining point, and a trailing `z`
 *  once the shape is closed. */
export const buildPathString = (
  points: PolygonPoint[],
  closed: boolean
): string => {
  if (points.length === 0) return "M 0 0";
  const [first, ...rest] = points;
  const segments = [
    `M ${first.x} ${first.y}`,
    ...rest.map((p) => `L ${p.x} ${p.y}`),
  ];
  if (closed) segments.push("z");
  return segments.join(" ");
};
