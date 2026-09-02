import { describe, expect, it } from "vitest";
import { deepEqual, HistoryStore, isEmptyValue } from "./history";

// Mirrors the unexported HISTORY_MAX_COUNT in history.ts.
const HISTORY_MAX_COUNT = 100;

describe("isEmptyValue", () => {
  it("is true for null and undefined", () => {
    expect(isEmptyValue(null)).toBe(true);
    expect(isEmptyValue(undefined)).toBe(true);
  });

  it("is true for {} and []", () => {
    expect(isEmptyValue({})).toBe(true);
    expect(isEmptyValue([])).toBe(true);
  });

  it("is false for a non-empty object or array", () => {
    expect(isEmptyValue({ a: 1 })).toBe(false);
    expect(isEmptyValue([1])).toBe(false);
  });

  it("is false for non-object primitives, including falsy ones", () => {
    expect(isEmptyValue(0)).toBe(false);
    expect(isEmptyValue("")).toBe(false);
    expect(isEmptyValue(false)).toBe(false);
  });
});

describe("deepEqual", () => {
  it("compares primitives by value", () => {
    expect(deepEqual(1, 1)).toBe(true);
    expect(deepEqual(1, 2)).toBe(false);
    expect(deepEqual("a", "a")).toBe(true);
  });

  it("treats differing types as unequal, even with loosely-equal values", () => {
    expect(deepEqual(1, "1")).toBe(false);
    expect(deepEqual(null, undefined)).toBe(false);
  });

  it("compares objects structurally, independent of key order", () => {
    expect(deepEqual({ a: 1, b: 2 }, { b: 2, a: 1 })).toBe(true);
    expect(deepEqual({ a: 1 }, { a: 1, b: 2 })).toBe(false);
  });

  it("compares arrays element-wise, order-sensitive", () => {
    expect(deepEqual([1, 2, 3], [1, 2, 3])).toBe(true);
    expect(deepEqual([1, 2, 3], [3, 2, 1])).toBe(false);
    expect(deepEqual([1, 2], [1, 2, 3])).toBe(false);
  });

  it("does not consider an array equal to an object", () => {
    expect(deepEqual([], {})).toBe(false);
  });

  it("recurses into nested structures", () => {
    const a = { objects: [{ type: "rect", left: 1 }] };
    const b = { objects: [{ type: "rect", left: 1 }] };
    const c = { objects: [{ type: "rect", left: 2 }] };
    expect(deepEqual(a, b)).toBe(true);
    expect(deepEqual(a, c)).toBe(false);
  });
});

describe("HistoryStore", () => {
  it("starts empty: no current/initial state, cannot undo or redo", () => {
    const store = new HistoryStore<{ v: number }>();
    expect(store.current).toBeNull();
    expect(store.initial).toBeNull();
    expect(store.canUndo()).toBe(false);
    expect(store.canRedo()).toBe(false);
  });

  it("the first save establishes initial/current without flagging a change", () => {
    const store = new HistoryStore<{ v: number }>();
    const changed = store.save({ v: 1 });
    expect(changed).toBe(false);
    expect(store.current).toEqual({ v: 1 });
    expect(store.initial).toEqual({ v: 1 });
    expect(store.canUndo()).toBe(false);
  });

  it("saving an unchanged (deep-equal) state is a no-op", () => {
    const store = new HistoryStore<{ v: number }>();
    store.save({ v: 1 });
    const changed = store.save({ v: 1 });
    expect(changed).toBe(false);
    expect(store.canUndo()).toBe(false);
  });

  it("saving a genuinely new state flags a change and enables undo", () => {
    const store = new HistoryStore<{ v: number }>();
    store.save({ v: 1 });
    const changed = store.save({ v: 2 });
    expect(changed).toBe(true);
    expect(store.current).toEqual({ v: 2 });
    expect(store.canUndo()).toBe(true);
    expect(store.canRedo()).toBe(false);
  });

  it("once current is emptied, the *next* save re-baselines initial and drops prior history", () => {
    const store = new HistoryStore<Record<string, unknown>>();
    store.save({ v: 1 });
    const clearingChanged = store.save({}); // canvas cleared
    expect(clearingChanged).toBe(true);
    expect(store.canUndo()).toBe(true);

    const rebaselined = store.save({ v: 2 });
    expect(rebaselined).toBe(false);
    expect(store.current).toEqual({ v: 2 });
    expect(store.initial).toEqual({ v: 2 });
    expect(store.canUndo()).toBe(false); // the v1 -> {} history is gone
  });

  it("undo moves current back one step and populates redo", () => {
    const store = new HistoryStore<{ v: number }>();
    store.save({ v: 1 });
    store.save({ v: 2 });
    const reloaded = store.undo();
    expect(reloaded).toBe(true);
    expect(store.current).toEqual({ v: 1 });
    expect(store.canUndo()).toBe(false);
    expect(store.canRedo()).toBe(true);
  });

  it("undo at the initial state is a no-op", () => {
    const store = new HistoryStore<{ v: number }>();
    store.save({ v: 1 });
    expect(store.undo()).toBe(false);
    expect(store.current).toEqual({ v: 1 });
  });

  it("undo on an empty store is a no-op", () => {
    const store = new HistoryStore<{ v: number }>();
    expect(store.undo()).toBe(false);
  });

  it("redo restores the state undo moved away from", () => {
    const store = new HistoryStore<{ v: number }>();
    store.save({ v: 1 });
    store.save({ v: 2 });
    store.undo();
    const reloaded = store.redo();
    expect(reloaded).toBe(true);
    expect(store.current).toEqual({ v: 2 });
    expect(store.canUndo()).toBe(true);
    expect(store.canRedo()).toBe(false);
  });

  it("redo with an empty redo stack is a no-op", () => {
    const store = new HistoryStore<{ v: number }>();
    store.save({ v: 1 });
    expect(store.redo()).toBe(false);
  });

  it("a fresh save after undo discards the redo branch", () => {
    const store = new HistoryStore<{ v: number }>();
    store.save({ v: 1 });
    store.save({ v: 2 });
    store.undo();
    expect(store.canRedo()).toBe(true);
    store.save({ v: 3 });
    expect(store.canRedo()).toBe(false);
    expect(store.current).toEqual({ v: 3 });
  });

  it("reset clears both stacks and re-baselines initial/current", () => {
    const store = new HistoryStore<{ v: number }>();
    store.save({ v: 1 });
    store.save({ v: 2 });
    store.save({ v: 3 });
    store.reset({ v: 99 });
    expect(store.current).toEqual({ v: 99 });
    expect(store.initial).toEqual({ v: 99 });
    expect(store.canUndo()).toBe(false);
    expect(store.canRedo()).toBe(false);
  });

  it("undo stack is capped at HISTORY_MAX_COUNT, dropping the oldest entry", () => {
    const store = new HistoryStore<{ v: number }>();
    for (let v = 1; v <= HISTORY_MAX_COUNT + 2; v++) {
      store.save({ v });
    }
    expect(store.current).toEqual({ v: HISTORY_MAX_COUNT + 2 });

    for (let i = 0; i < HISTORY_MAX_COUNT; i++) {
      expect(store.undo()).toBe(true);
    }
    // Oldest surviving entry is save(2)'s state, not save(1)'s -- {v:1}
    // only lives in `initial` and was itself evicted by the cap.
    expect(store.current).toEqual({ v: 2 });
    expect(store.canUndo()).toBe(false);

    // Quirk (see history.ts docstring): undo() with an already-empty undo
    // stack still reports a reload and duplicates `current` onto redo,
    // even though `current` isn't actually deep-equal to `initial` here.
    expect(store.canRedo()).toBe(true);
    expect(store.undo()).toBe(true);
    expect(store.current).toEqual({ v: 2 }); // unchanged
    expect(store.canUndo()).toBe(false);
  });
});
