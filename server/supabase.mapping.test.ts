import { describe, expect, it } from "vitest";
import { toSupabaseTransactionRow } from "./supabase";

describe("Supabase transaction mapping", () => {
  it("maps a form transaction to the transacoes schema", () => {
    const validUuid = "11111111-1111-4111-8111-111111111111";
    expect(toSupabaseTransactionRow({
      date: "2026-08-07",
      type: "despesa",
      amount: 125.5,
      category: "Moradia",
      subcategory: "Aluguel",
      subcategoria_id: validUuid,
      responsible: "Ambos",
      payment: "Pix",
      note: "Apartamento",
      installmentCount: 5,
      installmentNumber: 2,
      installmentGroupId: "grp-123"
    })).toEqual({
      descricao: "Apartamento",
      valor: 125.5,
      data: "2026-08-07",
      tipo: "despesa",
      categoria_id: null,
      subcategoria_id: validUuid,
      forma_pagamento: "Pix",
      parcelas: 5,
      parcela_atual: 2,
      grupo_parcela_id: "grp-123",
      responsavel: "Ambos",
    });
  });

  it("uses one parcela when the form has no installment metadata", () => {
    const row = toSupabaseTransactionRow({
      date: "2026-08-07",
      type: "receita",
      amount: 3000,
      category: "Receitas",
      subcategory: "Salário",
      responsible: "João Paulo",
      payment: null,
      note: null,
    });
    expect(row.parcelas).toBe(1);
    expect(row.parcela_atual).toBe(1);
  });
});

export {};
