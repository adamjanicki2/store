# @adamjanicki/store

_Warning: use at own risk! This library is primarily designed for usage by me across my other projects, so while I try to write good code, there will be some bugs, and more importantly, I make breaking changes often!_

## Installation

```bash
npm install @adamjanicki/store
```

## Usage

```tsx
import { createStore, persist } from "@adamjanicki/store";

const useCount = createStore({ init: 0 });

type Theme = "light" | "dark";

const useTheme = createStore<Theme>({
  init: "dark",
  plugins: [persist({ key: "theme", storage: "local" })],
});

function Counter() {
  const [count, setCount] = useCount();
  const [theme] = useTheme();
  return (
    <button className={theme} onClick={() => setCount((c) => c + 1)}>
      {count}
    </button>
  );
}
```
