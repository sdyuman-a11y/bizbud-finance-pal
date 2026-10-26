import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";

/** useState that saves to localStorage on this device (hydration-safe). */
export function usePersistentState<T>(key: string, initial: T): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(initial);
  const valueRef = useRef(value);

  // Load the saved value after hydration.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw != null) {
        const parsed = JSON.parse(raw) as T;
        valueRef.current = parsed;
        setValue(parsed);
      }
    } catch {
      // ignore corrupt storage
    }
  }, [key]);

  // Save only on explicit user changes, never on mount.
  const update = useCallback<Dispatch<SetStateAction<T>>>(
    (action) => {
      const next =
        typeof action === "function"
          ? (action as (prev: T) => T)(valueRef.current)
          : action;
      valueRef.current = next;
      setValue(next);
      try {
        window.localStorage.setItem(key, JSON.stringify(next));
      } catch {
        // storage full or unavailable
      }
    },
    [key],
  );

  return [value, update];
}
