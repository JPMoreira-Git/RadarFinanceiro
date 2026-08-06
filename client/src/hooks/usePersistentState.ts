import { useEffect, useState } from "react";

export type PersistentStorage = Pick<Storage, "getItem" | "setItem">;

export function readPersistentValue<T>(storage: PersistentStorage, key: string, initialValue: T) {
  try {
    const stored = storage.getItem(key);
    return stored ? (JSON.parse(stored) as T) : initialValue;
  } catch {
    return initialValue;
  }
}

export function writePersistentValue<T>(storage: PersistentStorage, key: string, value: T) {
  try {
    storage.setItem(key, JSON.stringify(value));
  } catch {
    // A interface continua utilizável mesmo se o navegador bloquear o armazenamento local.
  }
}

export function usePersistentState<T>(key: string, initialValue: T) {
  const [value, setValue] = useState<T>(() => {
    if (typeof window === "undefined") return initialValue;
    return readPersistentValue(window.localStorage, key, initialValue);
  });

  useEffect(() => {
    if (typeof window !== "undefined") writePersistentValue(window.localStorage, key, value);
  }, [key, value]);

  return [value, setValue] as const;
}
