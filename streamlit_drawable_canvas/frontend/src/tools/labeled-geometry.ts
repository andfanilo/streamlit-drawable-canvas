// Pure chip-geometry helpers for labeled rects. No Fabric or DOM dependency.

/** Chip height in screen px: one line of `fontSize` text plus top/bottom
 *  padding. */
export const chipHeight = (fontSize: number, padY: number): number =>
  fontSize + 2 * padY;

/** Whether the chip should flip to sit inside the box instead of above it.
 *  `boxTopInScene` is the box's top edge in scene/screen px. */
export const chipFlipsInside = (
  boxTopInScene: number,
  chipHeightPx: number,
  gap: number
): boolean => boxTopInScene - chipHeightPx - gap < 0;

/** Picks black or white text for legibility against an `[r, g, b]`
 *  background, by relative luminance. Ignores alpha. */
export const contrastTextColor = (
  rgb: readonly [number, number, number]
): "#000" | "#fff" => {
  const [r, g, b] = rgb;
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? "#000" : "#fff";
};
