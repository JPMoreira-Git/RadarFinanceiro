import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";

const mocks = vi.hoisted(() => ({
  deleteMutateAsync: vi.fn(),
  deleteManyMutateAsync: vi.fn(),
  refetch: vi.fn(),
}));

vi.mock("wouter", () => ({
  useLocation: () => ["/lancamentos", vi.fn()],
}));

vi.mock("@/lib/trpc", () => ({
  trpc: {
    transactions: {
      list: { useQuery: () => ({ data: [{ id: "55555555-5555-4555-8555-555555555555", descricao: "Moradia · Aluguel", valor: 100, data: "2026-08-05", tipo: "despesa", forma_pagamento: "Pix", parcelas: 1, responsavel: "Ambos" }], refetch: mocks.refetch }) },
      create: { useMutation: () => ({ mutateAsync: vi.fn() }) },
      delete: { useMutation: () => ({ mutateAsync: mocks.deleteMutateAsync }) },
      deleteMany: { useMutation: () => ({ mutateAsync: mocks.deleteManyMutateAsync }) },
    },
  },
}));

import Home from "./Home";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("Home exclusão remota", () => {
  it("envia o ID do lançamento clicado à mutation tRPC", async () => {
    mocks.deleteMutateAsync.mockResolvedValueOnce({});
    mocks.refetch.mockResolvedValueOnce({});
    render(<Home />);
    await userEvent.click(screen.getByRole("button", { name: "Excluir" }));
    expect(mocks.deleteMutateAsync).toHaveBeenCalledWith({ id: "55555555-5555-4555-8555-555555555555" });
    expect(mocks.refetch).toHaveBeenCalledTimes(1);
  });

  it("mostra alert e toast.error quando a mutation falha", async () => {
    mocks.deleteMutateAsync.mockRejectedValueOnce(new Error("Falha do Supabase"));
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => undefined);
    const toastSpy = vi.spyOn(toast, "error").mockImplementation(() => "toast-id");
    render(<Home />);
    await userEvent.click(screen.getByRole("button", { name: "Excluir" }));
    expect(alertSpy).toHaveBeenCalledWith("Falha do Supabase");
    expect(toastSpy).toHaveBeenCalledWith("Falha do Supabase");
    alertSpy.mockRestore();
    toastSpy.mockRestore();
  });
});

export {};
