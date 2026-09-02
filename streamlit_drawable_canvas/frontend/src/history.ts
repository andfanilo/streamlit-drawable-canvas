// Pure undo/redo store for canvas JSON snapshots. No Fabric imports, no DOM
// access -- operates on opaque JSON-serializable snapshots only, so Vitest
// can exercise it directly (T2).

const HISTORY_MAX_COUNT = 100;

export const isEmptyValue = (value: unknown): boolean => {
  if (value == null) return true;
  if (typeof value !== "object") return false;
  return Object.keys(value as Record<string, unknown>).length === 0;
};

export const deepEqual = (a: unknown, b: unknown): boolean => {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (a === null || b === null) return false;
  if (typeof a !== "object") return false;

  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b)) return false;
    if (a.length !== b.length) return false;
    return a.every((item, i) => deepEqual(item, b[i]));
  }

  const aObj = a as Record<string, unknown>;
  const bObj = b as Record<string, unknown>;
  const aKeys = Object.keys(aObj);
  const bKeys = Object.keys(bObj);
  if (aKeys.length !== bKeys.length) return false;
  return aKeys.every(
    (key) =>
      Object.prototype.hasOwnProperty.call(bObj, key) &&
      deepEqual(aObj[key], bObj[key])
  );
};

/**
 * Undo/redo store for canvas snapshots. Ported from the v1
 * `DrawableCanvasState.tsx` reducer (save/undo/redo/reset), preserving its
 * exact semantics -- including the quirk where `undo()` on an empty undo
 * stack still pushes the current state onto the redo stack.
 */
export class HistoryStore<T = unknown> {
  private undoStack: T[] = [];
  private redoStack: T[] = [];
  private initialState: T | null = null;
  private currentState: T | null = null;

  get current(): T | null {
    return this.currentState;
  }

  get initial(): T | null {
    return this.initialState;
  }

  canUndo(): boolean {
    return this.undoStack.length !== 0;
  }

  canRedo(): boolean {
    return this.redoStack.length !== 0;
  }

  /**
   * Save a new state. Returns true if `currentState` changed as a result
   * (i.e. the caller should reflect it back onto the live canvas / send it
   * to Streamlit); false if the save was a no-op (identical state, or the
   * very first save establishing the initial state).
   */
  save(state: T): boolean {
    if (isEmptyValue(this.currentState)) {
      this.undoStack = [];
      this.redoStack = [];
      this.initialState = state;
      this.currentState = state;
      return false;
    }
    if (deepEqual(state, this.currentState)) {
      return false;
    }

    const overMax = this.undoStack.length >= HISTORY_MAX_COUNT;
    this.undoStack = [
      ...this.undoStack.slice(overMax ? 1 : 0),
      this.currentState as T,
    ];
    this.redoStack = [];
    if (this.initialState == null) {
      this.initialState = this.currentState;
    }
    this.currentState = state;
    return true;
  }

  /** Returns true if the canvas should be reloaded from `current`. */
  undo(): boolean {
    if (
      isEmptyValue(this.currentState) ||
      deepEqual(this.initialState, this.currentState)
    ) {
      return false;
    }
    const isUndoEmpty = this.undoStack.length === 0;
    this.redoStack = [...this.redoStack, this.currentState as T];
    if (!isUndoEmpty) {
      this.currentState = this.undoStack[this.undoStack.length - 1];
    }
    this.undoStack = this.undoStack.slice(0, -1);
    return true;
  }

  /** Returns true if the canvas should be reloaded from `current`. */
  redo(): boolean {
    if (this.redoStack.length === 0) {
      return false;
    }
    this.undoStack = [...this.undoStack, this.currentState as T];
    this.currentState = this.redoStack[this.redoStack.length - 1];
    this.redoStack = this.redoStack.slice(0, -1);
    return true;
  }

  reset(state: T): void {
    this.undoStack = [];
    this.redoStack = [];
    this.initialState = state;
    this.currentState = state;
  }
}
