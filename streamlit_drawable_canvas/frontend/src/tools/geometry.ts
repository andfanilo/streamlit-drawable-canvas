// Pure geometry helpers for point editing (0.12.0-spec.md §3.5). No Fabric or
// DOM dependency, so Vitest can exercise it directly (T2).

export interface Point2D {
  x: number;
  y: number;
}

const isCloseCommand = (cmd: unknown): boolean =>
  typeof cmd === "string" && cmd.toLowerCase() === "z";

/** M/L/z command array -> vertices. `null` when it is not a closed M/L
 *  polygon: an open path, fewer than 3 vertices, or any command other than
 *  M/L/Z (case-insensitive) -- in particular any curve command (Q/C). */
export const pathCommandsToPoints = (path: unknown[]): Point2D[] | null => {
  const points: Point2D[] = [];
  let closed = false;
  for (const command of path) {
    if (!Array.isArray(command) || command.length === 0) return null;
    const [cmd, ...args] = command as [unknown, ...number[]];
    if (typeof cmd !== "string") return null;
    const upper = cmd.toUpperCase();
    if (upper === "M" || upper === "L") {
      if (args.length !== 2) return null;
      points.push({ x: args[0], y: args[1] });
    } else if (isCloseCommand(cmd)) {
      closed = true;
    } else {
      return null;
    }
  }
  if (!closed || points.length < 3) return null;
  return points;
};

/** Local-space corners of a `width x height` box, in tl, tr, br, bl order,
 *  centred on the origin (matches Fabric's own local coordinate space). */
export const boxCorners = (width: number, height: number): Point2D[] => {
  const hw = width / 2;
  const hh = height / 2;
  return [
    { x: -hw, y: -hh },
    { x: hw, y: -hh },
    { x: hw, y: hh },
    { x: -hw, y: hh },
  ];
};

/** Applies a 2x2 matrix `[a, b, c, d]` -- scale and skew, never rotation or
 *  translation -- to every point. */
export const applyMatrix2 = (
  points: Point2D[],
  m: [number, number, number, number]
): Point2D[] =>
  points.map((p) => ({
    x: m[0] * p.x + m[2] * p.y,
    y: m[1] * p.x + m[3] * p.y,
  }));

/** Drops the vertex at `index`. `null` when fewer than 3 vertices would
 *  remain -- a polygon needs at least a triangle. */
export const removeVertex = (
  points: Point2D[],
  index: number
): Point2D[] | null => {
  if (points.length <= 3) return null;
  return points.filter((_, i) => i !== index);
};

export const distance = (a: Point2D, b: Point2D): number =>
  Math.hypot(b.x - a.x, b.y - a.y);
