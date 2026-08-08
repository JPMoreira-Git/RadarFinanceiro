import { describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const { insertMock, deleteMock, deleteManyMock } = vi.hoisted(() => ({ insertMock: vi.fn(), deleteMock: vi.fn(), deleteManyMock: vi.fn() }));

vi.mock("./supabase", async () => {
  const actual = await vi.importActual<typeof import("./supabase")>("./supabase");
  return { ...actual, insertSupabaseTransactions: insertMock, deleteSupabaseTransaction: deleteMock, deleteSupabaseTransactions: deleteManyMock };
});

import { appRouter } from "./routers";

function createContext(): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "sample-user",
      email: "sample@example.com",
      name: "Sample User",
      loginMethod: "manus",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("transactions.create", () => {
  it("maps and inserts all installments in one Supabase batch", async () => {
    insertMock.mockResolvedValueOnce([{ id: "supabase-1" }, { id: "supabase-2" }]);
    const caller = appRouter.createCaller(createContext());

    await caller.transactions.create({
      transactions: [
        {
          date: "2026-08-07",
          type: "despesa",
          amount: 100,
          category: "Lazer",
          subcategory: "Viagem",
          responsible: "Ambos",
          payment: "Crédito",
          note: "Reserva",
          installmentGroupId: "parcelado-1",
          installmentNumber: 1,
          installmentCount: 2,
        },
        {
          date: "2026-09-07",
          type: "despesa",
          amount: 100,
          category: "Lazer",
          subcategory: "Viagem",
          responsible: "Ambos",
          payment: "Crédito",
          note: "Reserva",
          installmentGroupId: "parcelado-1",
          installmentNumber: 2,
          installmentCount: 2,
        },
      ],
    });

    expect(insertMock).toHaveBeenCalledTimes(1);
    expect(insertMock).toHaveBeenCalledWith([
      expect.objectContaining({ descricao: "Lazer · Viagem · Reserva", parcelas: 2, data: "2026-08-07" }),
      expect.objectContaining({ descricao: "Lazer · Viagem · Reserva", parcelas: 2, data: "2026-09-07" }),
    ]);
  });

  it("exclui uma transação usando o ID recebido", async () => {
    deleteMock.mockResolvedValueOnce(undefined);
    const caller = appRouter.createCaller(createContext());
    await caller.transactions.delete({ id: "11111111-1111-4111-8111-111111111111" });
    expect(deleteMock).toHaveBeenCalledWith("11111111-1111-4111-8111-111111111111");
  });

  it("exclui todas as parcelas em uma única operação em lote", async () => {
    deleteManyMock.mockResolvedValueOnce(undefined);
    const caller = appRouter.createCaller(createContext());
    await caller.transactions.deleteMany({ ids: ["22222222-2222-4222-8222-222222222222", "33333333-3333-4333-8333-333333333333", "44444444-4444-4444-8444-444444444444"] });
    expect(deleteManyMock).toHaveBeenCalledWith(["22222222-2222-4222-8222-222222222222", "33333333-3333-4333-8333-333333333333", "44444444-4444-4444-8444-444444444444"]);
  });
});

export {};
