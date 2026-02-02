import { useSyncExternalStore } from "react";

type NextState<T> = T | ((prev: T) => T);
type SetState<T, U> = (next: NextState<T>) => U;
type GetState<T> = () => T;
type Subscribe = (listener: () => void) => () => void;

type StoreOperations<T> = {
  getState: GetState<T>;
  setState: SetState<T, boolean>;
  subscribe: Subscribe;
};

type UseStore<T> = () => readonly [T, SetState<T, void>];

type Plugin<T> = (ops: StoreOperations<T>) => void;

function makeOps<T>(init: T): StoreOperations<T> {
  let state = init;
  const listeners = new Set<() => void>();

  const getState: GetState<T> = () => state;

  const setState: SetState<T, boolean> = (next) => {
    const nextState: T =
      typeof next === "function" ? (next as (prev: T) => T)(state) : next;
    if (Object.is(nextState, state)) return false;
    state = nextState;
    listeners.forEach((listener) => listener());
    return true;
  };

  const subscribe: Subscribe = (listener) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  };

  return { getState, setState, subscribe };
}

/** Options for creating a store hook */
type CreateStoreOptions<T> = {
  /** Value to initialize the state to */
  init: T;
  /** Plugins that can extend store behavior, e.g. storage option */
  plugins?: readonly Plugin<T>[] | Plugin<T>[];
};

/**
 * Creates a hook backed by a shared store.
 * The returned hook can be used across multiple components to read and update
 * the same state instance.
 *
 * @param options create store options
 * @returns a hook that returns the current state and a setter function
 */
export function createStore<T>({
  init,
  plugins,
}: CreateStoreOptions<T>): UseStore<T> {
  const ops = makeOps(init);

  plugins?.forEach((plugin) => plugin(ops));

  function useStore() {
    const value = useSyncExternalStore(
      ops.subscribe,
      ops.getState,
      ops.getState
    );
    const setState = (next: NextState<T>) => {
      ops.setState(next);
    };
    return [value, setState] as const;
  }

  return useStore;
}

type PersistStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

/** Options for the persist plugin function */
type PersistOptions = {
  /** Key to use to persist this state in local/session storage */
  key: string;
  /** Storage method to use; accepts local/session storage or a custom option */
  storage: "local" | "session" | PersistStorage;
};

/**
 * Creates a plugin that serializes/deserializes state to/from storage
 *
 * @param options including the storage key and type
 * @returns store plugin option
 */
export function persist<T>(options: PersistOptions): Plugin<T> {
  return (ops) => {
    const storage = getStorage(options.storage);
    if (!storage) return;

    try {
      const json = storage.getItem(options.key);
      if (json !== null) {
        const persisted = JSON.parse(json) as T;
        ops.setState((current) => mergeState(current, persisted));
      }
    } catch {}

    const baseSetState = ops.setState;

    ops.setState = (next) => {
      const succeeded = baseSetState(next);
      if (!succeeded) return false;
      try {
        storage.setItem(options.key, JSON.stringify(ops.getState()));
      } catch {}
      return true;
    };
  };
}

function mergeState<T>(current: T, persisted: T): T {
  if (isPlainObject(current) && isPlainObject(persisted)) {
    return { ...current, ...persisted };
  }
  return persisted;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object") return false;
  if (Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function getStorage(storage: PersistOptions["storage"]): PersistStorage | null {
  if (typeof storage !== "string") return storage;
  if (!window) return null;
  return storage === "local" ? window.localStorage : window.sessionStorage;
}
