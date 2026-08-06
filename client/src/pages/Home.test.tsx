import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import React from "react";
import { buildInvestmentExpenseWaterfall, DashboardView, financialChartBarY, financialChartLineY, financialChartY, FinancialRhythmChart, NewTransaction, percentageChange } from "./Home";

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

function DashboardHarness({ transactions }: { transactions: React.ComponentProps<typeof DashboardView>["transactions"] }) {
  const [month, setMonth] = React.useState("2026-08");
  return <DashboardView transactions={transactions} selectedMonth={month} onMonthChange={setMonth} />;
}

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
  it("mantém barra e ponto da linha na mesma coordenada Y no SVG renderizado", () => {
    const { container } = render(<FinancialRhythmChart data={[{ month: "jul", receita: 3020, investimentos: 3020, gastos: 0 }]} />);
    const bar = container.querySelector("rect");
    const investmentPoint = container.querySelector("circle");
    expect(bar?.getAttribute("y")).toBe(investmentPoint?.getAttribute("cy"));
  });

  it("usa a mesma escala vertical para barras e linhas do Ritmo Financeiro", () => {
    const barY = financialChartBarY(3020, 10840);
    const lineY = financialChartLineY(3020, 10840);
    expect(lineY).toBe(barY);
    expect(financialChartY(3020, 10840)).toBe(barY);
    expect(financialChartBarY(10840, 10840)).toBe(24);
    expect(financialChartY(0, 10840)).toBe(228);
  });

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

  it("navega para o mês anterior ao clicar no seletor", async () => {
    const onMonthChange = vi.fn();
    const user = userEvent.setup();
    render(<DashboardView selectedMonth="2026-08" onMonthChange={onMonthChange} transactions={[
      { id: 1, date: "2026-08-05", type: "receita", amount: 100, category: "Receitas", subcategory: "Salário", responsible: "João Paulo", payment: "Conta conjunta", note: "" },
      { id: 2, date: "2026-07-05", type: "despesa", amount: 50, category: "Moradia", subcategory: "Aluguel", responsible: "Danieli", payment: "Conta conjunta", note: "" },
    ]} />);
    const julyButtons = screen.getAllByRole("button", { name: /Selecionar julho/i });
    await user.click(julyButtons[julyButtons.length - 1]);
    expect(onMonthChange).toHaveBeenCalledWith("2026-07");
  });

  it("atualiza os cards e a atividade ao trocar para julho", async () => {
    const user = userEvent.setup();
    render(<DashboardHarness transactions={[
      { id: 1, date: "2026-08-05", type: "receita", amount: 10840, category: "Receitas", subcategory: "Salário", responsible: "João Paulo", payment: "Conta conjunta", note: "" },
      { id: 2, date: "2026-07-25", type: "receita", amount: 10480, category: "Receitas", subcategory: "Salário", responsible: "João Paulo", payment: "Conta conjunta", note: "" },
      { id: 3, date: "2026-07-20", type: "despesa", amount: 3020, category: "Moradia", subcategory: "Aluguel", responsible: "Danieli", payment: "Conta conjunta", note: "" },
    ]} />);
    expect(screen.getAllByText("R$ 10.840,00").length).toBeGreaterThan(0);
    const julyButtons = screen.getAllByRole("button", { name: /Selecionar julho/i });
    await user.click(julyButtons[julyButtons.length - 1]);
    expect(screen.getAllByText("R$ 10.480,00").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Aluguel").length).toBeGreaterThan(0);
  });

  it("usa o mês mais recente dos lançamentos como referência do dashboard", () => {
    render(<DashboardView transactions={[
      { id: 1, date: "2026-09-05", type: "despesa", amount: 120, category: "Alimentação", subcategory: "Supermercado", responsible: "João Paulo", payment: "Cartão principal", note: "" },
      { id: 2, date: "2026-08-05", type: "despesa", amount: 300, category: "Moradia", subcategory: "Aluguel", responsible: "Danieli", payment: "Conta conjunta", note: "" },
    ]} />);
    expect(screen.getByText("setembro 2026")).toBeInTheDocument();
    expect(screen.getByText("−60,0% em relação a agosto")).toBeInTheDocument();
  });

  it("não ancora o dashboard em agosto quando os lançamentos mais recentes são anteriores", () => {
    render(<DashboardView transactions={[{ id: 1, date: "2026-06-05", type: "despesa", amount: 120, category: "Alimentação", subcategory: "Supermercado", responsible: "João Paulo", payment: "Cartão principal", note: "" }]} />);
    expect(screen.getByText("junho 2026")).toBeInTheDocument();
  });

  it("renderiza um estado vazio sem lançar erro quando não há lançamentos", () => {
    expect(() => render(<DashboardView transactions={[]} />)).not.toThrow();
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
