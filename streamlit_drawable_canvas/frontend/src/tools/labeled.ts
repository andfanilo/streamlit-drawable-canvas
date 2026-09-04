// The labeled-rect payload: a shape-agnostic `withLabel` mixin plus the one
// concrete shape shipped here, `LabeledRect`.
import { Color, FabricObject, Point, Rect, classRegistry } from "fabric";
import {
  chipFlipsInside,
  chipHeight,
  contrastTextColor,
} from "./labeled-geometry";
import type { Point2D } from "./geometry";

const CHIP_PAD_X = 6;
const CHIP_PAD_Y = 4;
const CHIP_GAP = 4;
const CHIP_FONT_FAMILY = "system-ui, -apple-system, 'Segoe UI', sans-serif";
const FALLBACK_CHIP_COLOR = "#31333f";

/** The one thing `withLabel` asks its host shape for: the local-space
 *  (object-centred, unscaled) top-left corner to hang the chip from. */
export interface LabelAnchorProvider {
  getLabelAnchorLocal(): Point2D;
}

export interface LabelChipHost extends LabelAnchorProvider {
  label: string;
  fontSize: number;
  /** Transient, instance-only. Never serialized. */
  chipSuppressed: boolean;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type FabricObjectConstructor<T extends FabricObject = FabricObject> = new (
  ...args: any[]
) => T;

export const resolveChipColor = (
  stroke: unknown
): { fillStyle: string; rgb: [number, number, number] } => {
  if (typeof stroke === "string") {
    const parsed = new Color(stroke);
    if (!parsed.isUnrecognised) {
      const [r, g, b] = parsed.getSource();
      return { fillStyle: stroke, rgb: [r, g, b] };
    }
  }
  const [r, g, b] = new Color(FALLBACK_CHIP_COLOR).getSource();
  return { fillStyle: FALLBACK_CHIP_COLOR, rgb: [r, g, b] };
};

/** Draws the label chip above (or, near the canvas top, inside) the shape's
 *  anchor corner, at constant screen size regardless of box scale. */
const renderLabelChip = (
  ctx: CanvasRenderingContext2D,
  obj: FabricObject & LabelChipHost
): void => {
  if (!obj.label || obj.chipSuppressed) return;

  const { rgb, fillStyle } = resolveChipColor(obj.stroke);
  const textColor = contrastTextColor(rgb);
  const anchor = obj.getLabelAnchorLocal();
  const scaleX = obj.scaleX || 1;
  const scaleY = obj.scaleY || 1;

  ctx.save();
  ctx.scale(1 / scaleX, 1 / scaleY);
  const x = anchor.x * scaleX;
  const y = anchor.y * scaleY;

  ctx.font = `${obj.fontSize}px ${CHIP_FONT_FAMILY}`;
  const textWidth = ctx.measureText(obj.label).width;
  const h = chipHeight(obj.fontSize, CHIP_PAD_Y);
  const w = textWidth + 2 * CHIP_PAD_X;

  const boxTopInScene = obj.getBoundingRect().top;
  const flip = chipFlipsInside(boxTopInScene, h, CHIP_GAP);
  const chipTop = flip ? y + CHIP_GAP : y - CHIP_GAP - h;

  ctx.fillStyle = fillStyle;
  ctx.fillRect(x, chipTop, w, h);

  ctx.fillStyle = textColor;
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  ctx.fillText(obj.label, x + CHIP_PAD_X, chipTop + h / 2);

  ctx.restore();
};

/** Adds a label chip to any Fabric shape. The concrete class supplies
 *  `getLabelAnchorLocal`; everything else here is shape-agnostic. */
export const withLabel = <TBase extends FabricObjectConstructor>(
  Base: TBase
) => {
  class LabelHost extends Base {
    static customProperties = [
      ...((Base as unknown as { customProperties?: string[] })
        .customProperties ?? []),
      "label",
      "fontSize",
    ];

    declare label: string;
    declare fontSize: number;
    chipSuppressed = false;

    _render(ctx: CanvasRenderingContext2D): void {
      super._render(ctx);
      renderLabelChip(ctx, this as unknown as FabricObject & LabelChipHost);
    }
  }
  return LabelHost;
};

export interface ChipPlacement {
  /** Scene (canvas-pixel) coordinates for the relabel IText. */
  left: number;
  top: number;
  fillStyle: string;
  textColor: "#000" | "#fff";
}

/** Where the chip sits on the canvas, in scene coordinates. */
export const chipPlacement = (
  rect: FabricObject & LabelChipHost
): ChipPlacement => {
  const anchorLocal = rect.getLabelAnchorLocal();
  const anchorScene = new Point(anchorLocal.x, anchorLocal.y).transform(
    rect.calcTransformMatrix()
  );
  const h = chipHeight(rect.fontSize, CHIP_PAD_Y);
  const boxTopInScene = rect.getBoundingRect().top;
  const flip = chipFlipsInside(boxTopInScene, h, CHIP_GAP);
  const { fillStyle, rgb } = resolveChipColor(rect.stroke);
  return {
    left: anchorScene.x,
    top: flip ? anchorScene.y + CHIP_GAP : anchorScene.y - CHIP_GAP - h,
    fillStyle,
    textColor: contrastTextColor(rgb),
  };
};

export class LabeledRect extends withLabel(Rect) {
  static type = "LabeledRect";
  static ownDefaults = {
    label: "",
    fontSize: 20,
    lockRotation: true,
    objectCaching: false,
  };

  static getDefaults(): Record<string, unknown> {
    return { ...super.getDefaults(), ...LabeledRect.ownDefaults };
  }

  constructor(options: Record<string, unknown> = {}) {
    super(options);
    Object.assign(this, LabeledRect.ownDefaults);
    this.setOptions(options);
    this.setControlVisible("mtr", false);
  }

  getLabelAnchorLocal(): Point2D {
    return { x: -this.width / 2, y: -this.height / 2 };
  }
}

classRegistry.setClass(LabeledRect);
