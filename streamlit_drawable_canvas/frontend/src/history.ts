// Pure undo/redo store for canvas JSON snapshots. No Fabric imports, no DOM
// access -- operates on opaque JSON-serializable snapshots only, so Vitest
// can exercise it directly.

const HISTORY_MAX_COUNT = 100;

export const isEmptyValue = (value: unknown): boolean => {
  if (value == null) return true;
  if (typeof value !== "object") return false;
  return Object.keys(value as Record<string, unknown>).length === 0;
};

// Snapshots come from Fabric's `toObject()`, whose key order is stable, so
// this matches how `instance.ts` diffs `initialDrawing` and the tool config.
export const sameSnapshot = (a: unknown, b: unknown): boolean =>
  JSON.stringify(a) === JSON.stringify(b);

/**
 * Undo/redo store for canvas snapshots. `undo()` on an empty undo stack still
 * pushes the current state onto the redo stack -- a quirk callers rely on.
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
    if (sameSnapshot(state, this.currentState)) {
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
      sameSnapshot(this.initialState, this.currentState)
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
