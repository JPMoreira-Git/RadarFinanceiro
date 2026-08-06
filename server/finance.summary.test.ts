import { describe, expect, it } from "vitest";
import { summarizeTransactions } from "../shared/finance";

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
