import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSender, debounce } from "./debounce";

const WAIT = 200;

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("debounce", () => {
  it("does not fire before the wait elapses", () => {
    const fn = vi.fn();
    debounce(fn, WAIT)("a");

    vi.advanceTimersByTime(WAIT - 1);
    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(fn).toHaveBeenCalledExactlyOnceWith("a");
  });

  it("coalesces a burst into one call with the last value", () => {
    const fn = vi.fn();
    const debounced = debounce(fn, WAIT);

    debounced("a");
    vi.advanceTimersByTime(50);
    debounced("b");
    vi.advanceTimersByTime(50);
    debounced("c");
    vi.advanceTimersByTime(WAIT);

    expect(fn).toHaveBeenCalledExactlyOnceWith("c");
  });

  it("fires again for calls made after a delivery", () => {
    const fn = vi.fn();
    const debounced = debounce(fn, WAIT);

    debounced("a");
    vi.advanceTimersByTime(WAIT);
    debounced("b");
    vi.advanceTimersByTime(WAIT);

    expect(fn.mock.calls).toEqual([["a"], ["b"]]);
  });

  it("drops a pending value on cancel", () => {
    const fn = vi.fn();
    const debounced = debounce(fn, WAIT);

    debounced("a");
    debounced.cancel();
    vi.advanceTimersByTime(WAIT * 10);

    expect(fn).not.toHaveBeenCalled();
  });

  it("keeps working after a cancel", () => {
    const fn = vi.fn();
    const debounced = debounce(fn, WAIT);

    debounced("a");
    debounced.cancel();
    debounced("b");
    vi.advanceTimersByTime(WAIT);

    expect(fn).toHaveBeenCalledExactlyOnceWith("b");
  });

  it("is a no-op when cancelled with nothing pending", () => {
    const fn = vi.fn();
    const debounced = debounce(fn, WAIT);

    debounced.cancel();
    debounced("a");
    vi.advanceTimersByTime(WAIT);
    debounced.cancel();
    debounced.cancel();
    vi.advanceTimersByTime(WAIT * 10);

    expect(fn).toHaveBeenCalledExactlyOnceWith("a");
  });
});

describe("createSender", () => {
  it("coalesces scheduled values", () => {
    const send = vi.fn();
    const sender = createSender(send, WAIT);

    sender.schedule("a");
    sender.schedule("b");
    vi.advanceTimersByTime(WAIT);

    expect(send).toHaveBeenCalledExactlyOnceWith("b");
  });

  it("delivers an immediate value without waiting", () => {
    const send = vi.fn();
    createSender(send, WAIT).now("a");

    expect(send).toHaveBeenCalledExactlyOnceWith("a");
  });

  // The ordering bug this exists to prevent: a stale snapshot landing on top
  // of a right-click polygon close or a toolbar send.
  it("never delivers a scheduled value after an immediate one", () => {
    const send = vi.fn();
    const sender = createSender(send, WAIT);

    sender.schedule("stale");
    vi.advanceTimersByTime(WAIT - 1);
    sender.now("fresh");
    vi.advanceTimersByTime(WAIT * 10);

    expect(send).toHaveBeenCalledExactlyOnceWith("fresh");
  });

  it("schedules normally again after an immediate send", () => {
    const send = vi.fn();
    const sender = createSender(send, WAIT);

    sender.now("a");
    sender.schedule("b");
    vi.advanceTimersByTime(WAIT);

    expect(send.mock.calls).toEqual([["a"], ["b"]]);
  });

  // What disposeInstance relies on: no delivery against a disposed canvas.
  it("delivers nothing after cancel", () => {
    const send = vi.fn();
    const sender = createSender(send, WAIT);

    sender.schedule("a");
    sender.cancel();
    vi.advanceTimersByTime(WAIT * 10);

    expect(send).not.toHaveBeenCalled();
  });
});
