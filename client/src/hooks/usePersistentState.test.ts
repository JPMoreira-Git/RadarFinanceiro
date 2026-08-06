import { describe, expect, it } from "vitest";
import { readPersistentValue, writePersistentValue } from "./usePersistentState";

describe("usePersistentState persistence helpers", () => {
  it("restores reordered categories after a reload round-trip", () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    };
    const reordered = { Lazer: ["Viagens"], Moradia: ["Aluguel"], Transporte: ["Combustível"] };

    writePersistentValue(storage, "fluxo:categories", reordered);

    expect(readPersistentValue(storage, "fluxo:categories", {})).toEqual(reordered);
    expect(Object.keys(readPersistentValue(storage, "fluxo:categories", {}))).toEqual(["Lazer", "Moradia", "Transporte"]);
  });
});
