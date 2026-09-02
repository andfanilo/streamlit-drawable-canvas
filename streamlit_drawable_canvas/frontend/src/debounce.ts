// Trailing-edge debounce plus the send-scheduling policy built on it. No
// Fabric imports, no DOM access, so Vitest can exercise both directly (T2).

export interface Debounced<T> {
  (value: T): void;
  cancel(): void;
}

/**
 * Trailing-edge debounce: `fn` runs `waitMs` after the last call, with that
 * last call's value. `cancel()` drops a pending run.
 */
export const debounce = <T>(
  fn: (value: T) => void,
  waitMs: number
): Debounced<T> => {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let pending: { value: T } | null = null;

  const debounced = (value: T): void => {
    pending = { value };
    if (timer !== null) {
      clearTimeout(timer);
    }
    timer = setTimeout(() => {
      timer = null;
      const fired = pending as { value: T };
      pending = null;
      fn(fired.value);
    }, waitMs);
  };

  debounced.cancel = (): void => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
    pending = null;
  };

  return debounced;
};

export interface Sender<T> {
  /** Coalesce with any other scheduled value; delivers the last one. */
  schedule(value: T): void;
  /** Deliver now, dropping anything scheduled. */
  now(value: T): void;
  /** Drop anything scheduled without delivering it. */
  cancel(): void;
}

/**
 * Wraps `send` so scheduled deliveries coalesce and an immediate delivery
 * always supersedes a scheduled one: a value scheduled before an immediate
 * send is dropped, never delivered on top of it.
 */
export const createSender = <T>(
  send: (value: T) => void,
  waitMs: number
): Sender<T> => {
  const debounced = debounce(send, waitMs);
  return {
    schedule: (value: T) => debounced(value),
    now: (value: T) => {
      debounced.cancel();
      send(value);
    },
    cancel: () => debounced.cancel(),
  };
};
