import React from "react";

type SetState<T> = (next: T | ((prev: T) => T)) => void;
type GetState<T> = () => T;
type Subscribe = (listener: () => void) => () => void;

type Ops<T> = {
  getState: GetState<T>;
  setState: SetState<T>;
  subscribe: Subscribe;
};

type UseStore<T> = () => readonly [T, SetState<T>];

type Enhancer<T> = (ops: Ops<T>) => void;

function makeOps<T>(initialState: T): Ops<T> {
  let state = initialState;
  const listeners = new Set<() => void>();

  const getState: GetState<T> = () => state;

  const setState: SetState<T> = (next) => {
    const nextState: T =
      typeof next === "function" ? (next as (prev: T) => T)(state) : next;
    if (Object.is(nextState, state)) return;
    state = nextState;
    listeners.forEach((listener) => listener());
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
    return [value, ops.setState] as const;
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
        ops.setState(JSON.parse(json) as T);
      }
    } catch {}

    ops.setState = (next) => {
      ops.setState(next);
      try {
        storage.setItem(options.key, JSON.stringify(ops.getState()));
      } catch {}
    };
  };
}

function getStorage(storage: PersistOptions["storage"]): PersistStorage | null {
  if (typeof storage !== "string") return storage;
  try {
    return storage === "local" ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
}
