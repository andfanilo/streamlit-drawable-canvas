import { Canvas, IText, StaticCanvas } from "fabric";
import type {
  FrontendRendererArgs,
  FrontendState,
} from "@streamlit/component-v2-lib";

import {
  applyBackgroundImage,
  BackgroundImageFit,
  rescaleBackgroundImage,
} from "./background";
import { createSender, Sender } from "./debounce";
import { HistoryStore } from "./history";
import { buildToolbar, setToolbarState, ToolbarHandles } from "./toolbar";
import { tools } from "./tools";
import { convertLegacyPolygons } from "./tools/convert";
import { LOCK_PROPERTIES } from "./tools/lockProperties";

const SEND_DEBOUNCE_MS = 200;

export interface DrawableCanvasData {
  fillColor: string;
  strokeWidth: number;
  strokeColor: string;
  backgroundColor: string;
  backgroundImageURL: string | null;
  realtimeUpdateStreamlit: boolean;
  canvasWidth: number;
  canvasHeight: number;
  drawingMode: string;
  initialDrawing: Record<string, unknown>;
  displayRadius: number;
  returnImageData: boolean;
  disabled: boolean;
  backgroundImageFit: BackgroundImageFit;
  maxDisplayHeight: number | null;
  fontSize: number;
}

export interface DrawableCanvasDrawing {
  raw: Record<string, unknown>;
  data: string | null;
}

export interface DrawableCanvasState extends FrontendState {
  drawing?: DrawableCanvasDrawing;
}

type SetStateValue = FrontendRendererArgs<
  DrawableCanvasState,
  DrawableCanvasData
>["setStateValue"];

export interface CanvasInstance {
  container: HTMLDivElement;
  scrollEl: HTMLDivElement;
  canvasBox: HTMLDivElement;
  textareaHostEl: HTMLDivElement;
  canvas: Canvas;
  backgroundCanvas: StaticCanvas;
  toolbarEl: HTMLDivElement;
  toolbarHandles: ToolbarHandles;
  history: HistoryStore<Record<string, unknown>>;
  sender: Sender<Record<string, unknown>>;
  activeToolCleanup: (() => void) | null;
  lastToolKey: string | null;
  lastInitialDrawingKey: string | null;
  lastBackgroundImageURL: string | null;
  lastBackgroundImageFit: BackgroundImageFit | null;
  width: number;
  height: number;
  loadGeneration: number;
  backgroundGeneration: number;
  latest: {
    realtimeUpdateStreamlit: boolean;
    returnImageData: boolean;
    setStateValue: SetStateValue;
    data: DrawableCanvasData | null;
  };
  isTextEditing: boolean;
  polygonJustClosed: boolean;
}

/** Saves canvas state to history, scheduling a debounced realtime send if it
 *  changed. Returns the snapshot it saved. */
const saveAndMaybeSend = (
  instance: CanvasInstance
): Record<string, unknown> => {
  const state = instance.canvas.toObject(LOCK_PROPERTIES);
  const changed = instance.history.save(state);
  if (changed && instance.latest.realtimeUpdateStreamlit) {
    instance.sender.schedule(state);
  }
  return state;
};

/** Builds and delivers the payload. Runs at delivery time, so the PNG encode
 *  is skipped for snapshots a later one coalesced away. */
const emit = (
  instance: CanvasInstance,
  state: Record<string, unknown>
): void => {
  const data = instance.latest.returnImageData
    ? instance.canvas.toDataURL({ format: "png", multiplier: 1 })
    : null;
  instance.latest.setStateValue("drawing", { raw: state, data });
};

/** `hiddenTextareaContainer` isn't part of Fabric's serialized JSON -- it's a
 *  DOM reference -- so every IText arriving via `loadFromJSON` (initial load,
 *  undo/redo, reset) needs it re-applied, not just ones this tool creates
 *  fresh. Left unset, Fabric mounts the hidden textarea on `doc.body`, which
 *  is outside the shadow root (`isolate_styles=True`) and can't take input. */
const fixTextareaContainers = (
  canvas: Canvas,
  textareaHostEl: HTMLElement
): void => {
  canvas.forEachObject((o) => {
    if (o instanceof IText) {
      o.hiddenTextareaContainer = textareaHostEl;
    }
  });
};

/** Reloads the canvas from `history.current`. Returns false if a newer load
 *  superseded this one. */
const reloadCanvasFromHistory = async (
  instance: CanvasInstance
): Promise<boolean> => {
  const state = instance.history.current;
  if (state == null) return false;
  const generation = ++instance.loadGeneration;
  await instance.canvas.loadFromJSON(state);
  if (generation !== instance.loadGeneration) return false;
  fixTextareaContainers(instance.canvas, instance.textareaHostEl);
  convertLegacyPolygons(instance.canvas);
  instance.canvas.renderAll();
  if (instance.latest.data) {
    reconfigureTool(instance, instance.latest.data);
  }
  return true;
};

/** Makes the canvas inert: no drawing, no selection, no object events. */
const applyReadOnly = (canvas: Canvas): void => {
  canvas.isDrawingMode = false;
  canvas.selection = false;
  canvas.discardActiveObject();
  canvas.forEachObject((o) => {
    o.selectable = false;
    o.evented = false;
  });
  canvas.renderAll();
};

const reconfigureTool = (
  instance: CanvasInstance,
  data: DrawableCanvasData
): void => {
  instance.activeToolCleanup?.();
  instance.activeToolCleanup = null;
  if (data.disabled) {
    // No tool is registered at all, so no handler can mutate the canvas.
    applyReadOnly(instance.canvas);
    return;
  }
  const ToolConstructor = tools[data.drawingMode] ?? tools.freedraw;
  const tool = new ToolConstructor(instance.canvas);
  instance.activeToolCleanup = tool.configureCanvas({
    fillColor: data.fillColor,
    strokeWidth: data.strokeWidth,
    strokeColor: data.strokeColor,
    displayRadius: data.displayRadius,
    fontSize: data.fontSize,
    hiddenTextareaContainer: instance.textareaHostEl,
    onPolygonClosed: () => {
      instance.polygonJustClosed = true;
    },
  });
};

/** Reflects history depth, drawing mode and selection onto the toolbar. */
const syncToolbar = (instance: CanvasInstance): void => {
  setToolbarState(
    instance.toolbarHandles,
    instance.history.canUndo(),
    instance.history.canRedo(),
    instance.latest.data?.drawingMode === "edit",
    instance.canvas.getActiveObject() != null
  );
};

const commitToolbarMutation = (instance: CanvasInstance): void => {
  const state = saveAndMaybeSend(instance);
  if (instance.latest.realtimeUpdateStreamlit) {
    instance.sender.now(state);
  }
  syncToolbar(instance);
};

export const isToolbarVisible = (data: DrawableCanvasData): boolean =>
  !data.disabled;

/** Diffing key: changes iff a tool-affecting param changes. */
export const toolKeyFor = (data: DrawableCanvasData): string =>
  JSON.stringify([
    data.drawingMode,
    data.fillColor,
    data.strokeWidth,
    data.strokeColor,
    data.displayRadius,
    data.disabled,
    data.fontSize,
  ]);

export const createInstance = (mountPoint: HTMLElement): CanvasInstance => {
  const container = document.createElement("div");
  container.className = "dc-root";

  const scrollEl = document.createElement("div");
  scrollEl.className = "dc-scroll";

  const canvasBox = document.createElement("div");
  canvasBox.className = "dc-container";

  const backgroundCanvasEl = document.createElement("canvas");
  backgroundCanvasEl.className = "dc-background-canvas";

  const canvasEl = document.createElement("canvas");
  canvasEl.className = "dc-canvas";

  const toolbarEl = document.createElement("div");
  toolbarEl.className = "dc-toolbar";

  // Anchor for IText's hidden textarea -- see ConfigureCanvasProps'
  // `hiddenTextareaContainer` doc. Deliberately a sibling of `scrollEl`, not
  // a descendant: Fabric positions the textarea assuming a doc.body-relative
  // (page-absolute) coordinate space, so reparenting it under any ancestor
  // that isn't zero-sized/clipped either drags that ancestor's scrollable
  // area along with it (if inside `.dc-scroll`) or mispositions the textarea
  // relative to the canvas (if inside `.dc-container`).
  const textareaHostEl = document.createElement("div");
  textareaHostEl.className = "dc-textarea-host";

  canvasBox.append(backgroundCanvasEl, canvasEl);
  scrollEl.appendChild(canvasBox);
  container.append(scrollEl, toolbarEl, textareaHostEl);
  mountPoint.appendChild(container);

  const canvas = new Canvas(canvasEl, { enableRetinaScaling: false });
  // Fabric suppresses the browser's context menu by default; right-click has
  // no special meaning in any mode now, so let it show.
  canvas.stopContextMenu = false;

  const backgroundCanvas = new StaticCanvas(backgroundCanvasEl, {
    enableRetinaScaling: false,
  });

  const instance: CanvasInstance = {
    container,
    scrollEl,
    canvasBox,
    textareaHostEl,
    canvas,
    backgroundCanvas,
    toolbarEl,
    toolbarHandles: null as unknown as ToolbarHandles,
    history: new HistoryStore(),
    sender: null as unknown as Sender<Record<string, unknown>>,
    activeToolCleanup: null,
    lastToolKey: null,
    lastInitialDrawingKey: null,
    lastBackgroundImageURL: null,
    lastBackgroundImageFit: null,
    width: 0,
    height: 0,
    loadGeneration: 0,
    backgroundGeneration: 0,
    latest: {
      realtimeUpdateStreamlit: true,
      returnImageData: false,
      setStateValue: () => {},
      data: null,
    },
    isTextEditing: false,
    polygonJustClosed: false,
  };

  instance.sender = createSender(
    (state: Record<string, unknown>) => emit(instance, state),
    SEND_DEBOUNCE_MS
  );

  instance.toolbarHandles = buildToolbar(toolbarEl, {
    onSend: () => {
      instance.sender.now(canvas.toObject(LOCK_PROPERTIES));
    },
    onUndo: () => {
      if (instance.history.undo()) {
        void reloadCanvasFromHistory(instance).then((applied) => {
          if (applied && instance.latest.realtimeUpdateStreamlit) {
            instance.sender.now(canvas.toObject(LOCK_PROPERTIES));
          }
        });
        syncToolbar(instance);
      }
    },
    onRedo: () => {
      if (instance.history.redo()) {
        void reloadCanvasFromHistory(instance).then((applied) => {
          if (applied && instance.latest.realtimeUpdateStreamlit) {
            instance.sender.now(canvas.toObject(LOCK_PROPERTIES));
          }
        });
        syncToolbar(instance);
      }
    },
    onBringForward: () => {
      const active = canvas.getActiveObject();
      if (!active) return;
      canvas.bringObjectForward(active);
      canvas.renderAll();
      commitToolbarMutation(instance);
    },
    onSendBackward: () => {
      const active = canvas.getActiveObject();
      if (!active) return;
      canvas.sendObjectBackwards(active);
      canvas.renderAll();
      commitToolbarMutation(instance);
    },
    onDeleteSelected: () => {
      const active = canvas.getActiveObject();
      if (!active) return;
      canvas.discardActiveObject();
      canvas.remove(active);
      canvas.renderAll();
      commitToolbarMutation(instance);
    },
    onReset: () => {
      const resetTo = instance.history.initial ?? {};
      instance.history.reset(resetTo);
      // Always sent, even when update_streamlit=False.
      void reloadCanvasFromHistory(instance).then((applied) => {
        if (applied) {
          instance.sender.now(canvas.toObject(LOCK_PROPERTIES));
        }
      });
      syncToolbar(instance);
    },
  });

  // Both handlers defer via microtask so tool listeners, registered later,
  // run first within the same synchronous `fire()`. Both are canvas-level, so
  // they must bail out explicitly on a disabled canvas.
  canvas.on("mouse:up", () => {
    if (instance.latest.data?.disabled) return;
    // While an IText is being edited, every click that moves the caret would
    // otherwise write a history entry; the whole edit is saved once, on exit.
    if (instance.isTextEditing) return;
    const isPolygonClose = instance.polygonJustClosed;
    instance.polygonJustClosed = false;
    queueMicrotask(() => {
      const state = saveAndMaybeSend(instance);
      // A closed polygon always sends, even with update_streamlit=False --
      // an in-progress one is never a meaningful value, but the completed
      // shape is exactly the "give me the finished drawing" case.
      if (isPolygonClose) {
        instance.sender.now(state);
      }
      syncToolbar(instance);
    });
  });
  canvas.on("mouse:dblclick", () => {
    if (instance.latest.data?.disabled) return;
    if (instance.isTextEditing) return;
    queueMicrotask(() => {
      saveAndMaybeSend(instance);
      syncToolbar(instance);
    });
  });

  canvas.on("text:editing:entered", () => {
    instance.isTextEditing = true;
  });
  canvas.on("text:editing:exited", () => {
    instance.isTextEditing = false;
    queueMicrotask(() => {
      saveAndMaybeSend(instance);
      syncToolbar(instance);
    });
  });

  canvas.on("selection:created", () => syncToolbar(instance));
  canvas.on("selection:updated", () => syncToolbar(instance));
  canvas.on("selection:cleared", () => syncToolbar(instance));

  return instance;
};

export const applyData = (
  instance: CanvasInstance,
  data: DrawableCanvasData,
  setStateValue: SetStateValue
): void => {
  instance.latest.realtimeUpdateStreamlit = data.realtimeUpdateStreamlit;
  instance.latest.returnImageData = data.returnImageData;
  instance.latest.setStateValue = setStateValue;
  instance.latest.data = data;

  // 1. Resize
  const resized =
    instance.width !== data.canvasWidth ||
    instance.height !== data.canvasHeight;
  if (resized) {
    instance.width = data.canvasWidth;
    instance.height = data.canvasHeight;
    instance.canvas.setDimensions({
      width: data.canvasWidth,
      height: data.canvasHeight,
    });
    instance.backgroundCanvas.setDimensions({
      width: data.canvasWidth,
      height: data.canvasHeight,
    });
  }
  instance.canvasBox.style.width = `${data.canvasWidth}px`;
  instance.canvasBox.style.height = `${data.canvasHeight}px`;
  if (data.maxDisplayHeight != null) {
    instance.scrollEl.style.maxHeight = `${data.maxDisplayHeight}px`;
    instance.scrollEl.style.overflowY = "auto";
  } else {
    instance.scrollEl.style.maxHeight = "";
    instance.scrollEl.style.overflowY = "hidden";
  }
  instance.toolbarEl.style.display = isToolbarVisible(data) ? "flex" : "none";
  // Also covers polygon mode, where `realtimeUpdateStreamlit` is always false.
  instance.toolbarEl.dataset.pinned = String(!data.realtimeUpdateStreamlit);

  // 2. Background image (memoized on URL; a fit or size change re-fits the
  //    image already loaded rather than re-fetching it)
  const fitChanged =
    data.backgroundImageFit !== instance.lastBackgroundImageFit;
  instance.lastBackgroundImageFit = data.backgroundImageFit;
  if (data.backgroundImageURL !== instance.lastBackgroundImageURL) {
    instance.lastBackgroundImageURL = data.backgroundImageURL;
    const generation = ++instance.backgroundGeneration;
    void applyBackgroundImage(
      instance.backgroundCanvas,
      data.backgroundImageURL,
      () => generation === instance.backgroundGeneration,
      data.backgroundImageFit
    ).catch((error) => {
      console.error(
        "streamlit-drawable-canvas: failed to load background image",
        error
      );
      // Un-memoize so a later rerun with the same URL retries.
      if (generation === instance.backgroundGeneration) {
        instance.lastBackgroundImageURL = null;
      }
    });
  } else if (resized || fitChanged) {
    rescaleBackgroundImage(instance.backgroundCanvas, data.backgroundImageFit);
  }

  // 3. Initial drawing (memoized) -- reloading on every rerun would wipe the
  //    user's in-progress drawing.
  const initialDrawingKey = JSON.stringify(data.initialDrawing);
  const isFirstLoad = instance.lastInitialDrawingKey === null;
  const initialDrawingChanged =
    initialDrawingKey !== instance.lastInitialDrawingKey;

  if (initialDrawingChanged) {
    instance.lastInitialDrawingKey = initialDrawingKey;
    // A pre-load snapshot must not land on top of the drawing Python just
    // pushed.
    instance.sender.cancel();
    const generation = ++instance.loadGeneration;
    void instance.canvas.loadFromJSON(data.initialDrawing).then(() => {
      if (generation !== instance.loadGeneration) {
        return;
      }
      fixTextareaContainers(instance.canvas, instance.textareaHostEl);
      const convertedLegacyPolygon = convertLegacyPolygons(instance.canvas);
      instance.canvas.renderAll();
      // Snapshot the actual (post-conversion) canvas state, not the literal
      // input -- a legacy path-polygon must round-trip as the polygon it was
      // converted to, even for a canvas nothing else ever mutates.
      const loadedState = instance.canvas.toObject(LOCK_PROPERTIES);
      instance.history.reset(loadedState);
      const latestData = instance.latest.data ?? data;
      reconfigureTool(instance, latestData);
      instance.lastToolKey = toolKeyFor(latestData);
      syncToolbar(instance);
      // Propagate the reload immediately (not just on the next user
      // mutation), so a canvas fed by this one's json_data round-trips it
      // without lagging a rerun behind. A legacy-polygon conversion always
      // sends, even on first load and with update_streamlit=False -- display-
      // only must still hand back the converted payload (§3.4.2).
      if (
        (!isFirstLoad && instance.latest.realtimeUpdateStreamlit) ||
        convertedLegacyPolygon
      ) {
        instance.sender.now(loadedState);
      }
    });
  } else {
    // 4. Tool (memoized) -- only reconfigure when drawing-mode/style params
    //    actually changed.
    const toolKey = toolKeyFor(data);
    if (toolKey !== instance.lastToolKey) {
      instance.lastToolKey = toolKey;
      reconfigureTool(instance, data);
    }
  }

  syncToolbar(instance);
};

export const disposeInstance = (instance: CanvasInstance): void => {
  instance.sender.cancel();
  instance.activeToolCleanup?.();
  instance.canvas.dispose();
  instance.backgroundCanvas.dispose();
  instance.container.remove();
};
