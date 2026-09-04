// Per-shape Fabric `Control` sets for point editing. Controls don't
// serialize, so nothing here can leak into json_data.
import {
  Canvas,
  Circle,
  Control,
  FabricObject,
  Line,
  Point,
  Polygon,
  Rect,
  TPointerEventInfo,
  TPointerEvent,
  controlsUtils,
  util,
} from "fabric";
import { distance, Point2D, removeVertex } from "./geometry";
import { toPolygon } from "./convert";

const CLICK_SLOP_PX = 3;

const withClickToRemove = (
  index: number,
  onRemoveClick: (index: number) => void
): Pick<Control, "mouseDownHandler" | "mouseUpHandler"> => {
  let down: Point2D | null = null;
  return {
    mouseDownHandler: (_eventData, _transform, x, y) => {
      down = { x, y };
      return true;
    },
    mouseUpHandler: (_eventData, _transform, x, y) => {
      const wasClick = !!down && distance(down, { x, y }) < CLICK_SLOP_PX;
      down = null;
      if (wasClick) onRemoveClick(index);
      return true;
    },
  };
};

export const applyPolygonAnchors = (polygon: Polygon): void => {
  const controls = controlsUtils.createPolyControls(polygon, {
    cursorStyle: "pointer",
  });
  for (const [key, control] of Object.entries(controls)) {
    const index = Number(key.slice(1));
    Object.assign(
      control,
      withClickToRemove(index, (removedIndex) => {
        const anchorIndex = removedIndex === 0 ? 1 : 0;
        const anchor = polygon.points[anchorIndex];
        const before = new Point(anchor.x, anchor.y)
          .subtract(polygon.pathOffset)
          .transform(polygon.calcOwnMatrix());

        const next = removeVertex(polygon.points, removedIndex);
        if (!next) return; // 3-vertex floor -- removal is a no-op
        polygon.points = next;
        polygon.setDimensions();

        const after = new Point(anchor.x, anchor.y)
          .subtract(polygon.pathOffset)
          .transform(polygon.calcOwnMatrix());
        polygon.left -= after.x - before.x;
        polygon.top -= after.y - before.y;

        // setCoords() caches oCoords keyed off .controls; rebuild controls
        // first or a stale key crashes the next hit-test.
        applyPolygonAnchors(polygon);
        polygon.setCoords();
        polygon.canvas?.requestRenderAll();
      })
    );
  }
  polygon.controls = controls;
};

export const applyLineAnchors = (line: Line): void => {
  const makeControl = (index: 1 | 2): Control =>
    new Control({
      cursorStyle: "pointer",
      positionHandler: (_dim, _finalMatrix, target) => {
        const l = target as Line;
        const lp = l.calcLinePoints();
        const p = new Point(
          index === 1 ? lp.x1 : lp.x2,
          index === 1 ? lp.y1 : lp.y2
        );
        return p.transform(
          util.multiplyTransformMatrices(
            l.getViewportTransform(),
            l.calcTransformMatrix()
          )
        );
      },
      actionHandler: (_eventData, transform, x, y) => {
        const l = transform.target as Line;
        const otherLp = l.calcLinePoints();
        const otherLocal =
          index === 1
            ? { x: otherLp.x2, y: otherLp.y2 }
            : { x: otherLp.x1, y: otherLp.y1 };
        const fixedScene = new Point(otherLocal.x, otherLocal.y).transform(
          l.calcTransformMatrix()
        );

        const local = util.sendPointToPlane(
          new Point(x, y),
          undefined,
          l.calcOwnMatrix()
        );
        const cx = (l.x1 + l.x2) / 2;
        const cy = (l.y1 + l.y2) / 2;
        l.set(
          index === 1
            ? { x1: cx + local.x, y1: cy + local.y }
            : { x2: cx + local.x, y2: cy + local.y }
        );

        // With originX/Y "center", left/top is always the scene midpoint
        // of the two endpoints, at any angle.
        const movedScene = new Point(x, y);
        const center = fixedScene.add(movedScene).scalarDivide(2);
        l.set({ left: center.x, top: center.y });
        l.setCoords();
        return true;
      },
    });
  line.controls = { p1: makeControl(1), p2: makeControl(2) };
};

export const applyCircleAnchors = (circle: Circle): void => {
  const makeControl = (x: number, y: number): Control =>
    new Control({
      x,
      y,
      cursorStyle: "pointer",
      actionHandler: (_eventData, transform, px, py) => {
        const c = transform.target as Circle;
        const center = c.getCenterPoint();
        const newRadius =
          new Point(px, py).distanceFrom(center) / (c.scaleX || 1);
        c.set({ radius: newRadius, scaleX: 1, scaleY: 1 });
        c.setPositionByOrigin(center, "center", "center");
        c.setCoords();
        return true;
      },
    });
  circle.controls = {
    r0: makeControl(0.5, 0),
    r1: makeControl(-0.5, 0),
    r2: makeControl(0, 0.5),
    r3: makeControl(0, -0.5),
  };
};

export const applyRectPlaceholderAnchors = (rect: Rect): void => {
  rect.controls = {
    tl: new Control({ x: -0.5, y: -0.5, actionHandler: () => false }),
    tr: new Control({ x: 0.5, y: -0.5, actionHandler: () => false }),
    br: new Control({ x: 0.5, y: 0.5, actionHandler: () => false }),
    bl: new Control({ x: -0.5, y: 0.5, actionHandler: () => false }),
  };
};

export const installRectPointEditSwap = (
  canvas: Canvas,
  getPointEditObject: () => FabricObject | null,
  onSwap: (polygon: Polygon) => void
): (() => void) => {
  const handler = (o: TPointerEventInfo<TPointerEvent>) => {
    const rect = getPointEditObject();
    if (!(rect instanceof Rect)) return;
    const hit = rect.findControl(
      canvas.getViewportPoint(o.e),
      util.isTouchEvent(o.e)
    );
    if (!hit) return;
    const polygon = toPolygon(canvas, rect);
    if (!polygon) return;
    canvas.setActiveObject(polygon);
    onSwap(polygon);
    // Private API: busts Fabric's stale hover-cached _targetInfo.
    (
      canvas as unknown as { _resetTransformEventData: () => void }
    )._resetTransformEventData();
  };
  canvas.on("mouse:down:before", handler);
  return () => canvas.off("mouse:down:before", handler);
};
