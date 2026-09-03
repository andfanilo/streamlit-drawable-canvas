import type { FrontendRenderer } from "@streamlit/component-v2-lib";

import "./styles.css";
import {
  applyData,
  createInstance,
  disposeInstance,
  DrawableCanvasData,
  DrawableCanvasState,
} from "./instance";

// The renderer is re-invoked on every data change without its previous
// cleanup running first, so state that must survive reruns -- the Fabric
// canvas, undo/redo history, the active tool -- lives here, keyed by the
// stable `parentElement`, not in local variables.
const instances = new WeakMap<
  HTMLElement | ShadowRoot,
  ReturnType<typeof createInstance>
>();

const DrawableCanvasRenderer: FrontendRenderer<
  DrawableCanvasState,
  DrawableCanvasData
> = (args) => {
  const { data, parentElement, setStateValue } = args;

  // Never cache the mount point across invocations -- re-query every time.
  const mountPoint = parentElement.querySelector<HTMLElement>(".canvas-root");
  if (!mountPoint) {
    throw new Error("Unexpected: .canvas-root element not found");
  }

  let instance = instances.get(parentElement);
  if (!instance) {
    instance = createInstance(mountPoint);
    instances.set(parentElement, instance);
  } else if (!mountPoint.contains(instance.container)) {
    // Re-attach rather than draw into a detached canvas.
    mountPoint.appendChild(instance.container);
  }

  applyData(instance, data, setStateValue);

  return () => {
    const current = instances.get(parentElement);
    if (current) {
      disposeInstance(current);
      instances.delete(parentElement);
    }
  };
};

export default DrawableCanvasRenderer;
