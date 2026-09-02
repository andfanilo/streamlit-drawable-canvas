import { Canvas, StaticCanvas } from "fabric";
import type {
  FrontendRendererArgs,
  FrontendState,
} from "@streamlit/component-v2-lib";

import { applyBackgroundImage } from "./background";
import { HistoryStore } from "./history";
import { buildToolbar, setToolbarState, ToolbarHandles } from "./toolbar";
import { tools } from "./tools";

const TOOLBAR_HEIGHT = 32;

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

/** Saves canvas state to history and sends it if it changed. Returns
 *  whether it sent, so callers that also need to force-send on top (e.g.
 *  polygon close on right-click) can avoid sending twice. */
const saveAndMaybeSend = (instance: CanvasInstance): boolean => {
  const state = instance.canvas.toObject();
  const changed = instance.history.save(state);
  const shouldSend = changed && instance.latest.realtimeUpdateStreamlit;
  if (shouldSend) {
    sendToStreamlit(instance, state);
  }
  return shouldSend;
};

const sendToStreamlit = (
  instance: CanvasInstance,
  state: Record<string, unknown>
): void => {
  const data = instance.latest.returnImageData
    ? instance.canvas.toDataURL({ format: "png", multiplier: 1 })
    : null;
  instance.latest.setStateValue("drawing", { raw: state, data });
};

const reloadCanvasFromHistory = async (
  instance: CanvasInstance
): Promise<void> => {
  const state = instance.history.current;
  if (state == null) return;
  await instance.canvas.loadFromJSON(state);
  instance.canvas.renderAll();
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

  instance.toolbarHandles = buildToolbar(toolbarEl, {
    onSend: () => {
      sendToStreamlit(instance, instance.history.current ?? canvas.toObject());
    },
    onUndo: () => {
      if (instance.history.undo()) {
        void reloadCanvasFromHistory(instance).then(() => {
          if (instance.latest.realtimeUpdateStreamlit) {
            sendToStreamlit(instance, instance.history.current!);
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
        void reloadCanvasFromHistory(instance).then(() => {
          if (instance.latest.realtimeUpdateStreamlit) {
            sendToStreamlit(instance, instance.history.current!);
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
      void reloadCanvasFromHistory(instance).then(() => {
        // Always sent, even when update_streamlit=False -- an explicit
        // clear is a deliberate user action.
        sendToStreamlit(instance, resetTo);
      });
      setToolbarState(
        instance.toolbarHandles,
        instance.history.canUndo(),
        instance.history.canRedo()
      );
    },
  });

  canvas.on("mouse:up", (opt) => {
    const sent = saveAndMaybeSend(instance);
    const domEvent = opt.e as MouseEvent;
    if (domEvent && domEvent.button === 2 && !sent) {
      sendToStreamlit(instance, instance.history.current ?? canvas.toObject());
    }
    setToolbarState(
      instance.toolbarHandles,
      instance.history.canUndo(),
      instance.history.canRedo()
    );
  });
  canvas.on("mouse:dblclick", () => {
    // Deferred via microtask so tool-specific dblclick handlers -- which are
    // registered later (on tool reconfiguration) and therefore run after
    // this listener within the same synchronous `fire()` call -- get a
    // chance to finish mutating the canvas (e.g. closing a polygon, or
    // deleting the active object) before we snapshot it.
    queueMicrotask(() => {
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
  if (
    instance.width !== data.canvasWidth ||
    instance.height !== data.canvasHeight
  ) {
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
      // Un-memoize so a later rerun with the same (still-broken, or now
      // fixed) URL gets a retry instead of being silently swallowed by the
      // memo check above.
      if (generation === instance.backgroundGeneration) {
        instance.lastBackgroundImageURL = null;
      }
    });
  }

  // 3. Initial drawing (memoized) -- only reload when it actually changed,
  //    otherwise every unrelated rerun would wipe the user's in-progress
  //    drawing. `loadFromJSON` always defers via a microtask in Fabric 7, so
  //    guard against a stale resolution clobbering newer state with a
  //    generation counter.
  const initialDrawingKey = JSON.stringify(data.initialDrawing);
  const initialDrawingChanged =
    initialDrawingKey !== instance.lastInitialDrawingKey;

  if (initialDrawingChanged) {
    instance.lastInitialDrawingKey = initialDrawingKey;
    const generation = ++instance.loadGeneration;
    void instance.canvas.loadFromJSON(data.initialDrawing).then(() => {
      if (generation !== instance.loadGeneration) {
        // A newer initialDrawing arrived while this load was in flight.
        return;
      }
      instance.canvas.renderAll();
      instance.history.reset(data.initialDrawing);
      // Use the freshest data, not the closed-over `data` from when this
      // load started: a tool-only change may have arrived (and returned
      // synchronously, since it doesn't reload) while this load was still
      // in flight, and its params must win over this stale snapshot.
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
  instance.activeToolCleanup?.();
  instance.canvas.dispose();
  instance.backgroundCanvas.dispose();
  instance.container.remove();
};
