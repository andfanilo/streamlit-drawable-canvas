import {
  Circle,
  FabricObject,
  IText,
  Line,
  Polygon,
  Rect,
  TPointerEvent,
  TPointerEventInfo,
} from "fabric";
import { FabricTool, ConfigureCanvasProps, PointEditState } from "./fabrictool";
import { LOCK_PROPERTIES } from "./lockProperties";
import {
  applyCircleAnchors,
  applyLineAnchors,
  applyPolygonAnchors,
  applyRectPlaceholderAnchors,
  installRectPointEditSwap,
} from "./anchors";
import { chipPlacement, LabeledRect } from "./labeled";

const CLICK_SLOP_PX = 3;
const CORNER_SIZE = 10;
const TOUCH_CORNER_SIZE = 24;

type Editable = Polygon | Line | Rect | Circle;

const isDescendEligible = (
  obj: FabricObject | null | undefined
): obj is Editable => {
  if (!obj) return false;
  if (!(
    obj instanceof Polygon ||
    obj instanceof Line ||
    obj instanceof Rect ||
    obj instanceof Circle
  ))
    return false;
  const locked = obj as unknown as Record<string, unknown>;
  if (LOCK_PROPERTIES.some((key) => locked[key])) return false;
  if (obj instanceof Circle && obj.scaleX !== obj.scaleY) return false;
  return true;
};

const applyAnchorsFor = (obj: FabricObject): void => {
  if (obj instanceof Polygon) applyPolygonAnchors(obj);
  else if (obj instanceof Line) applyLineAnchors(obj);
  else if (obj instanceof Circle) applyCircleAnchors(obj);
  else if (obj instanceof Rect) applyRectPlaceholderAnchors(obj);
};

const snapshotOf = (obj: FabricObject): PointEditState["saved"] => ({
  controls: obj.controls,
  hasBorders: obj.hasBorders,
  cornerStyle: obj.cornerStyle,
  cornerColor: obj.cornerColor,
  cornerStrokeColor: obj.cornerStrokeColor,
  transparentCorners: obj.transparentCorners,
  cornerSize: obj.cornerSize,
  touchCornerSize: obj.touchCornerSize,
});

export class EditTool extends FabricTool {
  configureCanvas({
    pointEdit,
    pointEditCornerColor,
    pointEditCornerStrokeColor,
    hiddenTextareaContainer,
  }: ConfigureCanvasProps): () => void {
    const canvas = this.canvas;
    canvas.isDrawingMode = false;
    canvas.selection = true;
    canvas.forEachObject((o) => (o.selectable = o.evented = true));
    if (pointEdit.get()) canvas.selection = false;

    let relabelState: { rect: LabeledRect; itext: IText } | null = null;

    const beginRelabel = (rect: LabeledRect) => {
      const placement = chipPlacement(rect);
      rect.chipSuppressed = true;
      rect.dirty = true;
      const itext = new IText(rect.label, {
        left: placement.left,
        top: placement.top,
        originX: "left",
        originY: "top",
        fontSize: rect.fontSize,
        fill: placement.textColor,
        backgroundColor: placement.fillStyle,
        hiddenTextareaContainer,
        excludeFromExport: true,
      });
      canvas.add(itext);
      canvas.setActiveObject(itext);
      itext.enterEditing();
      itext.selectAll();
      canvas.selection = false;
      relabelState = { rect, itext };
      canvas.requestRenderAll();
    };

    const onTextEditingExited = (o: { target: IText }) => {
      if (!relabelState || o.target !== relabelState.itext) return;
      const { rect, itext } = relabelState;
      rect.label = itext.text ?? "";
      canvas.remove(itext);
      rect.chipSuppressed = false;
      rect.dirty = true;
      canvas.selection = true;
      relabelState = null;
      canvas.setActiveObject(rect);
      canvas.requestRenderAll();
    };
    canvas.on("text:editing:exited", onTextEditingExited);

    let downInfo: {
      target: FabricObject | null;
      alreadySelected: boolean;
      x: number;
      y: number;
    } | null = null;
    let cursorPatch: {
      object: FabricObject;
      original: string | null;
    } | null = null;

    const clearCursorPatch = () => {
      if (cursorPatch) cursorPatch.object.hoverCursor = cursorPatch.original;
      cursorPatch = null;
    };

    const applyCursorHint = () => {
      const active = canvas.getActiveObject();
      clearCursorPatch();
      if (!pointEdit.get() && isDescendEligible(active)) {
        cursorPatch = { object: active, original: active.hoverCursor };
        active.hoverCursor = "pointer";
      }
    };

    const descendOnto = (obj: Editable) => {
      pointEdit.set({ object: obj, saved: snapshotOf(obj) });
      canvas.selection = false;
      obj.set({
        hasBorders: false,
        cornerStyle: "circle",
        cornerColor: pointEditCornerColor,
        cornerStrokeColor: pointEditCornerStrokeColor,
        transparentCorners: false,
        cornerSize: CORNER_SIZE,
        touchCornerSize: TOUCH_CORNER_SIZE,
      });
      applyAnchorsFor(obj);
      obj.setCoords();
      canvas.requestRenderAll();
    };

    const enterPointEdit = (obj: Editable) => {
      clearCursorPatch();
      descendOnto(obj);
    };

    const exitPointEdit = () => {
      const state = pointEdit.get();
      if (!state) return;
      pointEdit.set(null);
      canvas.selection = true;
      state.object.set({ ...state.saved });
      state.object.setCoords();
      canvas.requestRenderAll();
    };

    const onMouseDown = (
      o: TPointerEventInfo<TPointerEvent> & { alreadySelected: boolean }
    ) => {
      const target = (o.target as FabricObject | undefined) ?? null;
      const p = canvas.getScenePoint(o.e);
      downInfo = { target, alreadySelected: o.alreadySelected, x: p.x, y: p.y };
    };

    const onMouseUp = (o: TPointerEventInfo<TPointerEvent>) => {
      const info = downInfo;
      downInfo = null;
      if (!info) return;
      const target = (o.target as FabricObject | undefined) ?? null;
      const current = pointEdit.get();

      if (!info.target) {
        if (current) exitPointEdit();
        applyCursorHint();
        return;
      }
      if (target !== info.target) return;

      if (current) {
        if (current.object !== info.target) exitPointEdit();
        applyCursorHint();
        return;
      }

      const p = canvas.getScenePoint(o.e);
      const moved = Math.hypot(p.x - info.x, p.y - info.y);
      if (moved < CLICK_SLOP_PX && info.alreadySelected) {
        if (target instanceof LabeledRect) {
          beginRelabel(target);
          applyCursorHint();
          return;
        }
        if (isDescendEligible(target)) {
          enterPointEdit(target);
        }
      }
      applyCursorHint();
    };

    canvas.on("mouse:down", onMouseDown);
    canvas.on("mouse:up", onMouseUp);
    canvas.on("selection:created", applyCursorHint);
    canvas.on("selection:updated", applyCursorHint);

    const rectSwapCleanup = installRectPointEditSwap(
      canvas,
      () => pointEdit.get()?.object ?? null,
      (polygon) => descendOnto(polygon)
    );

    return () => {
      if (relabelState) {
        relabelState.itext.exitEditing();
      }
      canvas.off("mouse:down", onMouseDown);
      canvas.off("mouse:up", onMouseUp);
      canvas.off("selection:created", applyCursorHint);
      canvas.off("selection:updated", applyCursorHint);
      canvas.off("text:editing:exited", onTextEditingExited);
      rectSwapCleanup();
      clearCursorPatch();
      exitPointEdit();
    };
  }
}

export type { PointEditState };
