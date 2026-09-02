import { Canvas, StaticCanvas } from "fabric";
import type {
  FrontendRendererArgs,
  FrontendState,
} from "@streamlit/component-v2-lib";

import { applyBackgroundImage, rescaleBackgroundImage } from "./background";
import { createSender, Sender } from "./debounce";
import { HistoryStore } from "./history";
import { buildToolbar, setToolbarState, ToolbarHandles } from "./toolbar";
import { tools } from "./tools";

const TOOLBAR_HEIGHT = 32;

// Matches v1's UpdateStreamlit.tsx.
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
  displayToolbar: boolean;
  displayRadius: number;
  returnImageData: boolean;
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
  backgroundCanvasEl: HTMLCanvasElement;
  canvasEl: HTMLCanvasElement;
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
}

/** Saves canvas state to history, scheduling a debounced realtime send if it
 *  changed. Returns the snapshot it saved. */
const saveAndMaybeSend = (
  instance: CanvasInstance
): Record<string, unknown> => {
  const state = instance.canvas.toObject();
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

/** Sends immediately, dropping any scheduled send. */
const sendToStreamlit = (
  instance: CanvasInstance,
  state: Record<string, unknown>
): void => {
  instance.sender.now(state);
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
  instance.canvas.renderAll();
  if (instance.latest.data) {
    reconfigureTool(instance, instance.latest.data);
  }
  return true;
};

const reconfigureTool = (
  instance: CanvasInstance,
  data: DrawableCanvasData
): void => {
  instance.activeToolCleanup?.();
  const ToolConstructor = tools[data.drawingMode] ?? tools.freedraw;
  const tool = new ToolConstructor(instance.canvas);
  instance.activeToolCleanup = tool.configureCanvas({
    fillColor: data.fillColor,
    strokeWidth: data.strokeWidth,
    strokeColor: data.strokeColor,
    displayRadius: data.displayRadius,
  });
};

/** Pure diffing key: changes iff a tool-affecting param changes (T2). */
export const toolKeyFor = (data: DrawableCanvasData): string =>
  JSON.stringify([
    data.drawingMode,
    data.fillColor,
    data.strokeWidth,
    data.strokeColor,
    data.displayRadius,
  ]);

export const createInstance = (mountPoint: HTMLElement): CanvasInstance => {
  const container = document.createElement("div");
  container.className = "dc-container";

  const backgroundCanvasEl = document.createElement("canvas");
  backgroundCanvasEl.className = "dc-background-canvas";

  const canvasEl = document.createElement("canvas");
  canvasEl.className = "dc-canvas";

  const toolbarEl = document.createElement("div");
  toolbarEl.className = "dc-toolbar";

  container.append(backgroundCanvasEl, canvasEl, toolbarEl);
  mountPoint.appendChild(container);

  const canvas = new Canvas(canvasEl, { enableRetinaScaling: false });
  canvas.stopContextMenu = true;
  canvas.fireRightClick = true;

  const backgroundCanvas = new StaticCanvas(backgroundCanvasEl, {
    enableRetinaScaling: false,
  });

  const instance: CanvasInstance = {
    container,
    backgroundCanvasEl,
    canvasEl,
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
  };

  instance.sender = createSender(
    (state: Record<string, unknown>) => emit(instance, state),
    SEND_DEBOUNCE_MS
  );

  instance.toolbarHandles = buildToolbar(toolbarEl, {
    onSend: () => {
      sendToStreamlit(instance, canvas.toObject());
    },
    onUndo: () => {
      if (instance.history.undo()) {
        void reloadCanvasFromHistory(instance).then((applied) => {
          if (applied && instance.latest.realtimeUpdateStreamlit) {
            sendToStreamlit(instance, canvas.toObject());
          }
        });
        setToolbarState(
          instance.toolbarHandles,
          instance.history.canUndo(),
          instance.history.canRedo()
        );
      }
    },
    onRedo: () => {
      if (instance.history.redo()) {
        void reloadCanvasFromHistory(instance).then((applied) => {
          if (applied && instance.latest.realtimeUpdateStreamlit) {
            sendToStreamlit(instance, canvas.toObject());
          }
        });
        setToolbarState(
          instance.toolbarHandles,
          instance.history.canUndo(),
          instance.history.canRedo()
        );
      }
    },
    onReset: () => {
      const resetTo = instance.history.initial ?? {};
      instance.history.reset(resetTo);
      // Always sent, even when update_streamlit=False.
      void reloadCanvasFromHistory(instance).then((applied) => {
        if (applied) {
          sendToStreamlit(instance, canvas.toObject());
        }
      });
      setToolbarState(
        instance.toolbarHandles,
        instance.history.canUndo(),
        instance.history.canRedo()
      );
    },
  });

  // Both handlers defer via microtask: tool listeners are registered later
  // and so run after these within the same synchronous `fire()`.
  canvas.on("mouse:up", (opt) => {
    const domEvent = opt.e as MouseEvent;
    const isRightClick = domEvent != null && domEvent.button === 2;
    queueMicrotask(() => {
      const state = saveAndMaybeSend(instance);
      if (isRightClick) {
        sendToStreamlit(instance, state);
      }
      setToolbarState(
        instance.toolbarHandles,
        instance.history.canUndo(),
        instance.history.canRedo()
      );
    });
  });
  canvas.on("mouse:dblclick", () => {
    queueMicrotask(() => {
      // In polygon mode a double-click removes the last points; it does not
      // close the polygon, so it does not force a send.
      saveAndMaybeSend(instance);
      setToolbarState(
        instance.toolbarHandles,
        instance.history.canUndo(),
        instance.history.canRedo()
      );
    });
  });

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
  instance.container.style.width = `${data.canvasWidth}px`;
  instance.container.style.height = `${
    data.canvasHeight + (data.displayToolbar ? TOOLBAR_HEIGHT : 0)
  }px`;
  instance.toolbarEl.style.top = `${data.canvasHeight + 4}px`;
  instance.toolbarEl.style.display = data.displayToolbar ? "flex" : "none";

  // 2. Background image (memoized)
  if (data.backgroundImageURL !== instance.lastBackgroundImageURL) {
    instance.lastBackgroundImageURL = data.backgroundImageURL;
    const generation = ++instance.backgroundGeneration;
    void applyBackgroundImage(
      instance.backgroundCanvas,
      data.backgroundImageURL,
      () => generation === instance.backgroundGeneration
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
  } else if (resized) {
    rescaleBackgroundImage(instance.backgroundCanvas);
  }

  // 3. Initial drawing (memoized) -- reloading on every rerun would wipe the
  //    user's in-progress drawing.
  const initialDrawingKey = JSON.stringify(data.initialDrawing);
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
      instance.canvas.renderAll();
      instance.history.reset(data.initialDrawing);
      const latestData = instance.latest.data ?? data;
      reconfigureTool(instance, latestData);
      instance.lastToolKey = toolKeyFor(latestData);
      setToolbarState(
        instance.toolbarHandles,
        instance.history.canUndo(),
        instance.history.canRedo()
      );
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

  setToolbarState(
    instance.toolbarHandles,
    instance.history.canUndo(),
    instance.history.canRedo()
  );
};

export const disposeInstance = (instance: CanvasInstance): void => {
  instance.sender.cancel();
  instance.activeToolCleanup?.();
  instance.canvas.dispose();
  instance.backgroundCanvas.dispose();
  instance.container.remove();
};
