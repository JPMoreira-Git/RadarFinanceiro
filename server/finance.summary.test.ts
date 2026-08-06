import { describe, expect, it } from "vitest";
import { aggregateMonthly, buildInstallmentTransactions, filterTransactions, installmentDate, normalizeInstallments, removeTransactionScope, shouldShowInstallments, splitInstallments, summarizeTransactions } from "../shared/finance";

describe("summarizeTransactions", () => {
  it("calculates income, expenses, balance and investment coverage", () => {
    const summary = summarizeTransactions([
      { type: "receita", amount: 1000, subcategory: "Salário" },
      { type: "receita", amount: 200, subcategory: "Rendimento de investimentos" },
      { type: "despesa", amount: 500, subcategory: "Supermercado" },
    ]);

    expect(summary).toEqual({
      receita: 1200,
      despesas: 500,
      investimentos: 200,
      saldo: 700,
      cobertura: 40,
    });
  });

  it("returns zero coverage when there are no expenses", () => {
    expect(summarizeTransactions([{ type: "receita", amount: 100, subcategory: "Salário" }]).cobertura).toBe(0);
  });
});

describe("installments", () => {
  it("splits cents without losing the original total", () => {
    const installments = splitInstallments(100, 3);
    expect(installments).toEqual([33.34, 33.33, 33.33]);
    expect(installments.reduce((sum, value) => sum + value, 0)).toBeCloseTo(100, 2);
  });

  it("advances each installment by one calendar month", () => {
    expect(installmentDate("2026-08-06", 0)).toBe("2026-08-06");
    expect(installmentDate("2026-08-06", 2)).toBe("2026-10-06");
  });
});

describe("parcelled summary", () => {
  it("counts only the installment belonging to the selected month", () => {
    const amounts = splitInstallments(300, 3);
    const august = summarizeTransactions([
      { type: "despesa", amount: amounts[0], subcategory: "Supermercado" },
      { type: "receita", amount: 200, subcategory: "Rendimento de investimentos" },
    ]);
    const september = summarizeTransactions([{ type: "despesa", amount: amounts[1], subcategory: "Supermercado" }]);
    expect(august.despesas).toBe(100);
    expect(august.cobertura).toBe(200);
    expect(september.despesas).toBe(100);
  });
});

describe("filters and monthly aggregation", () => {
  const transactions = [
    { date: "2026-08-06", type: "despesa" as const, amount: 100, category: "Alimentação", subcategory: "Supermercado", responsible: "Você", payment: "Cartão principal" },
    { date: "2026-08-07", type: "despesa" as const, amount: 200, category: "Moradia", subcategory: "Aluguel", responsible: "Esposa", payment: "Conta conjunta" },
    { date: "2026-09-06", type: "despesa" as const, amount: 100, category: "Alimentação", subcategory: "Supermercado", responsible: "Você", payment: "Cartão principal" },
  ];

  it("filters parcel installments by month, category and responsible", () => {
    expect(filterTransactions(transactions, { month: "2026-08", category: "Alimentação", responsible: "Você" })).toHaveLength(1);
    expect(filterTransactions(transactions, { month: "2026-09", category: "Alimentação" })[0]?.amount).toBe(100);
  });

  it("aggregates monthly expenses and investment income", () => {
    const series = aggregateMonthly([
      { date: "2026-08-06", type: "despesa" as const, amount: 100, subcategory: "Supermercado" },
      { date: "2026-08-07", type: "receita" as const, amount: 250, subcategory: "Rendimento de investimentos" },
    ], [["2026-08", "Ago"]] as const);
    expect(series).toEqual([{ month: "Ago", receita: 250, investimentos: 250, gastos: 100 }]);
  });
});

describe("transaction deletion scope", () => {
  const group = [
    { id: 1, installmentGroupId: "g1" },
    { id: 2, installmentGroupId: "g1" },
    { id: 3 },
  ];

  it("removes only the selected installment or the full group", () => {
    expect(removeTransactionScope(group, group[0]!, "item").map((item) => item.id)).toEqual([2, 3]);
    expect(removeTransactionScope(group, group[0]!, "group").map((item) => item.id)).toEqual([3]);
  });
});

describe("installment input", () => {
  it("defaults empty, zero or invalid values to one installment", () => {
    expect(normalizeInstallments("")).toBe(1);
    expect(normalizeInstallments("0")).toBe(1);
    expect(normalizeInstallments("abc")).toBe(1);
    expect(normalizeInstallments("3")).toBe(3);
  });
});

describe("installment form behavior", () => {
  it("shows installments only for credit-card expenses", () => {
    expect(shouldShowInstallments("despesa", "Cartão principal")).toBe(true);
    expect(shouldShowInstallments("receita", "Cartão principal")).toBe(false);
    expect(shouldShowInstallments("despesa", "Conta conjunta")).toBe(false);
  });

  it("submits an empty installment field as one installment", () => {
    expect(normalizeInstallments("")).toBe(1);
  });
});

describe("buildInstallmentTransactions", () => {
  it("creates one plain transaction when a card purchase has no installment count", () => {
    const created = buildInstallmentTransactions({
      idSeed: 100,
      date: "2026-08-06",
      type: "despesa",
      amount: 120,
      category: "Alimentação",
      subcategory: "Supermercado",
      responsible: "Você",
      payment: "Cartão principal",
      note: "Compra simples",
      installments: "",
    });

    expect(created).toHaveLength(1);
    expect(created[0]).toMatchObject({ amount: 120, date: "2026-08-06" });
    expect(created[0]?.installmentGroupId).toBeUndefined();
    expect(created[0]?.installmentNumber).toBeUndefined();
    expect(created[0]?.installmentCount).toBeUndefined();
  });
});
