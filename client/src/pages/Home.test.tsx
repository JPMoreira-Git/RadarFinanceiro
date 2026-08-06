import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import React from "react";
import { buildInvestmentExpenseWaterfall, DashboardView, NewTransaction, percentageChange } from "./Home";

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver;

const categories = {
  Moradia: ["Aluguel"],
  Receitas: ["Salário"],
};

describe("InvestmentExpenseWaterfall", () => {
  it("calcula o saldo mensal e a soma acumulada depois de agosto", () => {
    const steps = buildInvestmentExpenseWaterfall([
      { id: 1, date: "2026-01-05", type: "receita", amount: 100, category: "Receitas", subcategory: "Rendimento de investimentos", responsible: "João Paulo", payment: "Conta investimentos", note: "" },
      { id: 2, date: "2026-02-05", type: "despesa", amount: 50, category: "Moradia", subcategory: "Aluguel", responsible: "Danieli", payment: "Conta conjunta", note: "" },
      { id: 3, date: "2026-03-05", type: "receita", amount: 150, category: "Receitas", subcategory: "Rendimento de investimentos", responsible: "João Paulo", payment: "Conta investimentos", note: "" },
    ]);
    expect(steps.slice(0, 3).map(({ label, value }) => ({ label, value }))).toEqual([{ label: "Jan", value: 100 }, { label: "Fev", value: -50 }, { label: "Mar", value: 150 }]);
    expect(steps.at(-1)).toMatchObject({ label: "Acumulado", value: 200, isTotal: true });
  });
});

describe("DashboardView", () => {
  it("calcula a evolução percentual das despesas contra o mês anterior", () => {
    expect(Number(percentageChange(966.1, 3020)?.toFixed(1))).toBe(-68);
    expect(percentageChange(100, 0)).toBeNull();
  });

  it("exibe a porcentagem de despesas em relação a julho", () => {
    render(<DashboardView transactions={[
      { id: 1, date: "2026-08-05", type: "despesa", amount: 966.1, category: "Alimentação", subcategory: "Supermercado", responsible: "João Paulo", payment: "Cartão principal", note: "" },
      { id: 2, date: "2026-07-05", type: "despesa", amount: 3020, category: "Moradia", subcategory: "Aluguel", responsible: "Danieli", payment: "Conta conjunta", note: "" },
    ]} />);
    expect(screen.getByText("−68,0% em relação a julho")).toBeInTheDocument();
  });
});

describe("NewTransaction", () => {
  it("permite apagar a quantidade e digitar 2 sem exibir 12", async () => {
    const user = userEvent.setup();
    render(<NewTransaction onAdd={vi.fn()} categoriesData={categories} payments={["Crédito", "Pix", "Débito", "Dinheiro"]} />);

    const responsible = screen.getByRole("combobox", { name: "Responsável" });
    expect(responsible).toHaveValue("João Paulo");
    expect(screen.getByRole("option", { name: "João Paulo" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Danieli" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Você" })).not.toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Esposa" })).not.toBeInTheDocument();

    const payment = screen.getByRole("combobox", { name: "Forma de pagamento" });
    await user.selectOptions(payment, "Crédito");

    const installments = screen.getByRole("spinbutton", { name: "Quantidade de parcelas" });
    await user.clear(installments);
    await user.type(installments, "2");

    expect(installments).toHaveValue(2);
    expect(installments).not.toHaveValue(12);
  });
});
