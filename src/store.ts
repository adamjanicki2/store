import React from "react";

type NextState<T> = T | ((prev: T) => T);
type SetState<T, V> = (next: NextState<T>) => V;
type GetState<T> = () => T;
type Subscribe = (listener: () => void) => () => void;

type Ops<T> = {
  getState: GetState<T>;
  setState: SetState<T, boolean>;
  subscribe: Subscribe;
};

type UseStore<T> = () => readonly [T, SetState<T, void>];

type Enhancer<T> = (ops: Ops<T>) => void;

function makeOps<T>(initialState: T): Ops<T> {
  let state = initialState;
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

export function createStore<T>(
  initialState: T,
  enhancer?: Enhancer<T>
): UseStore<T> {
  const ops = makeOps(initialState);

  enhancer?.(ops);

  function useStore() {
    const value = React.useSyncExternalStore(
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
type PersistOptions = {
  key: string;
  storage: "local" | "session" | PersistStorage;
};

export function persist<T>(options: PersistOptions): Enhancer<T> {
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
