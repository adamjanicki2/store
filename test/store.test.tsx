import { act, render, screen } from "@testing-library/react";
import React from "react";

import { createStore, persist } from "../src";

function makeMemoryStorage() {
  const map = new Map<string, string>();

  const storage = {
    getItem: jest.fn((key: string) => map.get(key) ?? null),
    setItem: jest.fn((k: string, v: string) => map.set(k, v)),
    removeItem: jest.fn((k: string) => map.delete(k)),
  };

  return storage;
}

describe("createStore", () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });
  it("returns initial state and setter tuple", () => {
    const useCount = createStore(0);

    function Wrapper() {
      const [count] = useCount();
      return <div data-testid="count">{count}</div>;
    }

    render(<Wrapper />);

    expect(screen.getByTestId("count")).toHaveTextContent("0");
  });

  it("updates state when set is called with a value", () => {
    const useCount = createStore(0);

    function Wrapper() {
      const [count, setCount] = useCount();
      return (
        <div>
          <div data-testid="count">{count}</div>
          <button onClick={() => setCount(5)}>set</button>
        </div>
      );
    }

    render(<Wrapper />);

    expect(screen.getByTestId("count")).toHaveTextContent("0");

    act(() => {
      screen.getByRole("button", { name: "set" }).click();
    });

    expect(screen.getByTestId("count")).toHaveTextContent("5");
  });

  it("updates state when set is called with a callback", () => {
    const useCount = createStore(0);

    function Wrapper() {
      const [count, setCount] = useCount();
      return (
        <div>
          <div data-testid="count">{count}</div>
          <button onClick={() => setCount((c) => c + 1)}>inc</button>
        </div>
      );
    }

    render(<Wrapper />);

    act(() => {
      screen.getByRole("button", { name: "inc" }).click();
      screen.getByRole("button", { name: "inc" }).click();
      screen.getByRole("button", { name: "inc" }).click();
    });

    expect(screen.getByTestId("count")).toHaveTextContent("3");
  });

  it("does not rerender when setting to the same value", () => {
    const useCount = createStore(0);
    const renderSpy = jest.fn();

    function Wrapper() {
      const [count, setCount] = useCount();

      React.useEffect(() => {
        renderSpy(count);
      }, [count]);

      return (
        <div>
          <div data-testid="count">{count}</div>
          <button onClick={() => setCount(0)}>same</button>
          <button onClick={() => setCount(1)}>diff</button>
        </div>
      );
    }

    render(<Wrapper />);

    expect(renderSpy).toHaveBeenCalledTimes(1);
    expect(renderSpy).toHaveBeenLastCalledWith(0);

    act(() => {
      screen.getByRole("button", { name: "same" }).click();
    });

    expect(renderSpy).toHaveBeenCalledTimes(1);

    act(() => {
      screen.getByRole("button", { name: "diff" }).click();
    });

    expect(renderSpy).toHaveBeenCalledTimes(2);
    expect(renderSpy).toHaveBeenLastCalledWith(1);
  });

  it("supports multiple components using the same store", () => {
    const useCount = createStore(0);

    function A() {
      const [count] = useCount();
      return <div data-testid="a">{count}</div>;
    }

    function B() {
      const [count, setCount] = useCount();
      return (
        <div>
          <div data-testid="b">{count}</div>
          <button onClick={() => setCount((c) => c + 1)}>inc</button>
        </div>
      );
    }

    render(
      <div>
        <A />
        <B />
      </div>
    );

    expect(screen.getByTestId("a")).toHaveTextContent("0");
    expect(screen.getByTestId("b")).toHaveTextContent("0");

    act(() => {
      screen.getByRole("button", { name: "inc" }).click();
    });

    expect(screen.getByTestId("a")).toHaveTextContent("1");
    expect(screen.getByTestId("b")).toHaveTextContent("1");
  });

  it("does not update after a component is unmounted", () => {
    const useCount = createStore(0);
    const effectSpy = jest.fn();

    let setCallback: (n: number) => void;

    function Wrapper() {
      const [count, setCount] = useCount();
      setCallback = setCount;

      React.useEffect(() => {
        effectSpy(count);
      }, [count]);

      return <div data-testid="count">{count}</div>;
    }

    const { unmount } = render(<Wrapper />);

    expect(effectSpy).toHaveBeenCalledTimes(1);
    expect(effectSpy).toHaveBeenLastCalledWith(0);

    unmount();

    act(() => setCallback(1));

    expect(effectSpy).toHaveBeenCalledTimes(1);
  });

  it("deserializes storage on creation", () => {
    const storage = makeMemoryStorage();
    storage.setItem("k", JSON.stringify({ a: 2, b: 3 }));

    const useObj = createStore(
      { a: 1, b: 1, c: 9 },
      persist({ key: "k", storage })
    );

    function Wrapper() {
      const [value] = useObj();
      return (
        <div>
          <div data-testid="a">{value.a}</div>
          <div data-testid="b">{value.b}</div>
          <div data-testid="c">{value.c}</div>
        </div>
      );
    }

    render(<Wrapper />);

    expect(screen.getByTestId("a")).toHaveTextContent("2");
    expect(screen.getByTestId("b")).toHaveTextContent("3");
    expect(screen.getByTestId("c")).toHaveTextContent("9");
  });

  it("does not merge non-objects", () => {
    const storage = makeMemoryStorage();
    storage.setItem("k", JSON.stringify("dark"));

    const usePref = createStore("system", persist({ key: "k", storage }));

    function Wrapper() {
      const [pref] = usePref();
      return <div data-testid="pref">{pref}</div>;
    }

    render(<Wrapper />);

    expect(screen.getByTestId("pref")).toHaveTextContent("dark");
  });

  it("writes to storage on set with a value", () => {
    const storage = makeMemoryStorage();

    const useCount = createStore(0, persist({ key: "count", storage }));

    function Wrapper() {
      const [count, setCount] = useCount();
      return (
        <div>
          <div data-testid="count">{count}</div>
          <button onClick={() => setCount(7)}>set</button>
        </div>
      );
    }

    render(<Wrapper />);

    act(() => {
      screen.getByRole("button", { name: "set" }).click();
    });

    expect(screen.getByTestId("count")).toHaveTextContent("7");
    expect(storage.setItem).toHaveBeenCalledTimes(1);
    expect(storage.setItem).toHaveBeenLastCalledWith(
      "count",
      JSON.stringify(7)
    );
  });

  it("writes to storage on set with a callback", () => {
    const storage = makeMemoryStorage();

    const useCount = createStore(0, persist({ key: "count", storage }));

    function Wrapper() {
      const [count, setCount] = useCount();
      return (
        <div>
          <div data-testid="count">{count}</div>
          <button onClick={() => setCount((c) => c + 1)}>inc</button>
        </div>
      );
    }

    render(<Wrapper />);

    act(() => {
      screen.getByRole("button", { name: "inc" }).click();
      screen.getByRole("button", { name: "inc" }).click();
    });

    expect(screen.getByTestId("count")).toHaveTextContent("2");
    expect(storage.setItem).toHaveBeenCalledTimes(2);
    expect(storage.setItem).toHaveBeenLastCalledWith(
      "count",
      JSON.stringify(2)
    );
  });

  it("does not blow up if storage throws", () => {
    const faultyStorage = {
      getItem: jest.fn(() => {
        throw new Error("error");
      }),
      setItem: jest.fn(() => {
        throw new Error("error");
      }),
      removeItem: jest.fn(() => {
        throw new Error("error");
      }),
    };

    const useCount = createStore(
      0,
      persist({ key: "k", storage: faultyStorage })
    );

    function Wrapper() {
      const [count, setCount] = useCount();
      return (
        <div>
          <div data-testid="count">{count}</div>
          <button onClick={() => setCount(1)}>set</button>
        </div>
      );
    }

    render(<Wrapper />);

    expect(screen.getByTestId("count")).toHaveTextContent("0");

    act(() => {
      screen.getByRole("button", { name: "set" }).click();
    });

    expect(screen.getByTestId("count")).toHaveTextContent("1");
  });

  it("does not blow up if persisted JSON is invalid", () => {
    const storage = makeMemoryStorage();
    storage.setItem("k", "{bad}");

    const useObj = createStore({ a: 1 }, persist({ key: "k", storage }));

    function Wrapper() {
      const [value] = useObj();
      return <div data-testid="a">{value.a}</div>;
    }

    render(<Wrapper />);

    expect(screen.getByTestId("a")).toHaveTextContent("1");
  });

  it("calls getItem once during deserialization", () => {
    const storage = makeMemoryStorage();
    storage.setItem("k", JSON.stringify(123));

    createStore(0, persist({ key: "k", storage }));
    expect(storage.getItem).toHaveBeenCalledTimes(1);
    expect(storage.getItem).toHaveBeenLastCalledWith("k");
  });

  it("does not write to storage when state doesn't change", () => {
    const storage = makeMemoryStorage();

    const useCount = createStore(0, persist({ key: "k", storage }));

    function Wrapper() {
      const [count, setCount] = useCount();
      return (
        <div>
          <div data-testid="count">{count}</div>
          <button onClick={() => setCount(count)}>same</button>
        </div>
      );
    }

    render(<Wrapper />);

    act(() => {
      screen.getByRole("button", { name: "same" }).click();
    });

    expect(storage.setItem).toHaveBeenCalledTimes(0);
  });
});
