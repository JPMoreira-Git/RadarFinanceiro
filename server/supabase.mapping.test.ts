import { describe, expect, it } from "vitest";
import { toSupabaseTransactionRow } from "./supabase";

describe("Supabase transaction mapping", () => {
  it("maps a form transaction to the transacoes schema", () => {
    expect(toSupabaseTransactionRow({
      date: "2026-08-07",
      type: "despesa",
      amount: 125.5,
      category: "Moradia",
      subcategory: "Aluguel",
      responsible: "Ambos",
      payment: "Pix",
      note: "Apartamento",
      installmentCount: 5,
    })).toEqual({
      descricao: "Moradia · Aluguel · Apartamento",
      valor: 125.5,
      data: "2026-08-07",
      tipo: "despesa",
      categoria_id: null,
      forma_pagamento: "Pix",
      parcelas: 5,
      responsavel: "Ambos",
    });
  });

  it("uses one parcela when the form has no installment metadata", () => {
    expect(toSupabaseTransactionRow({
      date: "2026-08-07",
      type: "receita",
      amount: 3000,
      category: "Receitas",
      subcategory: "Salário",
      responsible: "João Paulo",
      payment: null,
      note: null,
    }).parcelas).toBe(1);
  });
});

export {};
