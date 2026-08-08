import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => cleanup());
import React from "react";
import { buildIncomeExpenseWaterfall, buildInvestmentExpenseWaterfall, DashboardView, DivergingBalanceCard, divergingBarY, financialChartBarY, financialChartLineY, financialChartY, FinancialRhythmChart, lineLabelOffsets, NewTransaction, percentageChange, transactionMonthOptions, mapSupabaseTransaction, normalizeRemoteTransactionType, resolveTransactions, handleDeleteError, deleteTransactionRemotely, TransactionsView, buildDashboardChartData } from "./Home";

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

describe("Supabase transaction loading", () => {
  it("normaliza tipos e valores remotos para o formato do gráfico", () => {
    expect(normalizeRemoteTransactionType("income")).toBe("receita");
    expect(normalizeRemoteTransactionType("DESPESA")).toBe("despesa");
    expect(mapSupabaseTransaction({ id: 9, descricao: "Receitas · Salário", valor: "1250.50" as unknown as number, data: "2026-08-31T12:00:00Z", tipo: "income", forma_pagamento: null, parcelas: null, responsavel: "João Paulo" })).toMatchObject({ id: 9, amount: 1250.5, date: "2026-08-31", type: "receita" });
  });

  it("normaliza uma linha remota preservando a data usada pelo filtro mensal", () => {
    const transaction = mapSupabaseTransaction({
      id: 22,
      descricao: "Moradia · Aluguel · Parcela remota",
      valor: 780,
      data: "2025-11-14",
      tipo: "despesa",
      forma_pagamento: "Pix",
      parcelas: 3,
      responsavel: "Ambos",
    });

    expect(transaction).toMatchObject({
      id: 22,
      date: "2025-11-14",
      category: "Moradia",
      subcategory: "Aluguel",
      note: "Parcela remota",
      installmentCount: 3,
    });
    expect(transactionMonthOptions([transaction])).toEqual([{ value: "2025-11", label: "Novembro 2025" }]);
  });
});

describe("Lançamentos com dados remotos", () => {
  const remoteRows = [
    { id: 1, descricao: "Moradia · Aluguel", valor: 100, data: "2026-08-05", tipo: "despesa" as const, forma_pagamento: "Pix", parcelas: 1, responsavel: "Ambos" },
    { id: 2, descricao: "Receitas · Salário", valor: 200, data: "2026-07-05", tipo: "receita" as const, forma_pagamento: null, parcelas: 1, responsavel: "João Paulo" },
    { id: 3, descricao: "Lazer · Viagens", valor: 300, data: "2025-12-05", tipo: "despesa" as const, forma_pagamento: "Crédito", parcelas: 2, responsavel: "Danieli" },
  ];

  it("exibe e aplica o intervalo de datas às linhas remotas", async () => {
    render(<TransactionsView
      transactions={resolveTransactions(remoteRows, [])}
      onDelete={vi.fn()}
      onDeleteGroup={vi.fn()}
      onUpdate={vi.fn()}
      onUpdateGroup={vi.fn()}
      categoriesData={categories}
      payments={["Pix", "Crédito"]}
    />);

    const fromInput = screen.getByLabelText("De");
    const toInput = screen.getByLabelText("Até");
    expect((fromInput as HTMLInputElement).value).toMatch(/^\d{4}-\d{2}-01$/);
    expect((toInput as HTMLInputElement).value).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(screen.queryByRole("combobox", { name: "Filtrar por mês" })).not.toBeInTheDocument();
    expect(screen.getByText("Aluguel")).toBeInTheDocument();

    await userEvent.clear(fromInput);
    await userEvent.type(fromInput, "2026-07-01");
    await userEvent.clear(toInput);
    await userEvent.type(toInput, "2026-07-31");
    expect(screen.getByText("Salário")).toBeInTheDocument();
    expect(screen.queryByText("Aluguel")).not.toBeInTheDocument();
  });

  it("envia o ID correto ao clicar no botão de excluir", async () => {
    const onDelete = vi.fn();
    render(<TransactionsView transactions={resolveTransactions(remoteRows, [])} onDelete={onDelete} onDeleteGroup={vi.fn()} onUpdate={vi.fn()} onUpdateGroup={vi.fn()} categoriesData={categories} payments={["Pix", "Crédito"]} />);
    await userEvent.click(screen.getAllByRole("button", { name: "Excluir" })[0]);
    expect(onDelete).toHaveBeenCalledWith(1);
  });

  it("envia o ID ao mutateAsync no fluxo remoto usado pelo Home", async () => {
    const mutateAsync = vi.fn().mockResolvedValue({});
    const onSuccess = vi.fn();
    const refetch = vi.fn().mockResolvedValue({});
    await deleteTransactionRemotely(1, { mutateAsync }, onSuccess, refetch);
    expect(mutateAsync).toHaveBeenCalledWith({ id: 1 });
    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it("exibe alert e toast quando o fluxo remoto retorna erro", async () => {
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => undefined);
    const mutateAsync = vi.fn().mockRejectedValue(new Error("Falha do Supabase"));
    const refetch = vi.fn();
    await deleteTransactionRemotely(1, { mutateAsync }, vi.fn(), refetch);
    expect(alertSpy).toHaveBeenCalledWith("Falha do Supabase");
    expect(refetch).not.toHaveBeenCalled();
    alertSpy.mockRestore();
  });

  it("mantém a série do dashboard independente do intervalo da listagem", () => {
    const series = buildDashboardChartData(resolveTransactions(remoteRows, []), "2026-08");
    expect(series.find((item) => item.month === "jul")?.receita).toBe(200);
    expect(series.find((item) => item.month === "ago")?.gastos).toBe(100);
  });

  it("usa os dados locais somente enquanto a resposta remota está indisponível", () => {
    const local = [{ id: 9, date: "2024-01-05", type: "despesa" as const, amount: 10, category: "Moradia", subcategory: "Aluguel", responsible: "Ambos", payment: "Pix", note: "" }];
    expect(resolveTransactions(undefined, local)).toBe(local);
    expect(resolveTransactions([], local)).toEqual([]);
  });
});

describe("transactionMonthOptions", () => {
  it("deriva meses e anos únicos das datas das transações em ordem decrescente", () => {
    const options = transactionMonthOptions([
      { id: 1, date: "2026-07-05", type: "despesa", amount: 10, category: "Moradia", subcategory: "Aluguel", responsible: "Ambos", payment: "Pix", note: "" },
      { id: 2, date: "2026-08-01", type: "receita", amount: 20, category: "Receitas", subcategory: "Salário", responsible: "João Paulo", payment: "", note: "" },
      { id: 3, date: "2025-12-15", type: "despesa", amount: 30, category: "Lazer", subcategory: "Viagens", responsible: "Danieli", payment: "Crédito", note: "" },
      { id: 4, date: "2026-07-22", type: "despesa", amount: 40, category: "Lazer", subcategory: "Viagens", responsible: "Danieli", payment: "Crédito", note: "" },
      { id: 5, date: "data inválida", type: "despesa", amount: 50, category: "Lazer", subcategory: "Viagens", responsible: "Danieli", payment: "Crédito", note: "" },
    ]);

    expect(options).toEqual([
      { value: "2026-08", label: "Agosto 2026" },
      { value: "2026-07", label: "Julho 2026" },
      { value: "2025-12", label: "Dezembro 2025" },
    ]);
  });
});

describe("InvestmentExpenseWaterfall", () => {
  it("posiciona saldos positivos acima e negativos abaixo da linha central", () => {
    expect(divergingBarY(673.9, 1440)).toBeLessThan(82);
    expect(divergingBarY(-1440, 1440)).toBeGreaterThan(82);
    expect(divergingBarY(0, 1440)).toBe(82);
  });
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

  it("posiciona os rótulos conforme a linha que está acima", () => {
    expect(lineLabelOffsets(100, 140)).toEqual({ investments: -8, expenses: 16 });
    expect(lineLabelOffsets(160, 120)).toEqual({ investments: 16, expenses: -8 });
    expect(lineLabelOffsets(130, 130)).toEqual({ investments: -8, expenses: 16 });
  });

  it("posiciona os rótulos do SVG acima e abaixo dos marcadores correspondentes", () => {
    const { container, rerender } = render(<FinancialRhythmChart data={[{ month: "jul", receita: 10840, investimentos: 3020, gastos: 1500 }]} />);
    const getTextY = (value: string) => Number(Array.from(container.querySelectorAll("text")).find((node) => node.textContent === value)?.getAttribute("y"));
    const getCircleY = (index: number) => Number(container.querySelectorAll("circle")[index]?.getAttribute("cy"));
    expect(getTextY("3.020")).toBeLessThan(getCircleY(0));
    expect(getTextY("1.500")).toBeGreaterThan(getCircleY(1));

    rerender(<FinancialRhythmChart data={[{ month: "jul", receita: 10840, investimentos: 1500, gastos: 3020 }]} />);
    expect(getTextY("1.500")).toBeGreaterThan(getCircleY(0));
    expect(getTextY("3.020")).toBeLessThan(getCircleY(1));
  });

  it("calcula Renda Total menos Despesas com todas as receitas do mês", () => {
    const steps = buildIncomeExpenseWaterfall([
      { id: 1, date: "2026-01-05", type: "receita", amount: 100, category: "Receitas", subcategory: "Salário", responsible: "João Paulo", payment: "Conta conjunta", note: "" },
      { id: 2, date: "2026-01-10", type: "receita", amount: 40, category: "Receitas", subcategory: "Rendimento de investimentos", responsible: "Danieli", payment: "Conta investimentos", note: "" },
      { id: 3, date: "2026-01-20", type: "despesa", amount: 80, category: "Moradia", subcategory: "Aluguel", responsible: "Danieli", payment: "Conta conjunta", note: "" },
      { id: 4, date: "2026-02-05", type: "despesa", amount: 50, category: "Alimentação", subcategory: "Supermercado", responsible: "João Paulo", payment: "Conta conjunta", note: "" },
    ]);
    expect(steps.slice(0, 2).map(({ label, value }) => ({ label, value }))).toEqual([{ label: "Jan", value: 60 }, { label: "Fev", value: -50 }]);
    expect(steps.at(-1)).toMatchObject({ label: "Acumulado", value: 10, isTotal: true });
  });

  it("usa o título Renda Total x Despesas e rótulos gráficos sem R$ ou sinais", () => {
    const { container } = render(<DashboardView selectedMonth="2026-08" transactions={[
      { id: 1, date: "2026-08-05", type: "receita", amount: 7400, category: "Receitas", subcategory: "Salário", responsible: "João Paulo", payment: "Conta conjunta", note: "" },
      { id: 2, date: "2026-08-06", type: "despesa", amount: 1000, category: "Moradia", subcategory: "Aluguel", responsible: "Danieli", payment: "Conta conjunta", note: "" },
    ]} />);
    const view = within(container);
    expect(view.getByText("Renda Total x Despesas")).toBeInTheDocument();
    expect(view.queryByText("Segundo cenário")).not.toBeInTheDocument();
    expect(view.getAllByText("6.400").length).toBeGreaterThan(0);
    expect(view.queryByText("+6.400")).not.toBeInTheDocument();
    expect(view.queryByText("R$6.400")).not.toBeInTheDocument();
  });

  it("mantém o acumulado sem renderizar uma barra Resultado duplicada", () => {
    render(<DivergingBalanceCard title="Investimentos x Despesas" values={[{ label: "Ago", value: 60 }]} />);
    expect(screen.queryByText("Resultado")).not.toBeInTheDocument();
    expect(screen.getByText("Resultado acumulado")).toBeInTheDocument();
    expect(screen.getAllByText(/R\$ 60,00/).length).toBeGreaterThan(0);
    expect(screen.queryByText("Saldos positivos acima da linha; déficits abaixo")).not.toBeInTheDocument();
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

  it("exibe a porcentagem de receitas em relação a julho", () => {
    render(<DashboardView transactions={[
      { id: 1, date: "2026-08-05", type: "receita", amount: 10840, category: "Receitas", subcategory: "Salário", responsible: "João Paulo", payment: "Conta conjunta", note: "" },
      { id: 2, date: "2026-07-05", type: "receita", amount: 10480, category: "Receitas", subcategory: "Salário", responsible: "Danieli", payment: "Conta conjunta", note: "" },
    ]} />);
    expect(screen.getByText("+3,4% em relação a julho")).toBeInTheDocument();
  });

  it("usa verde para queda das despesas e vermelho para aumento", () => {
    const { rerender } = render(<DashboardView transactions={[
      { id: 1, date: "2026-08-05", type: "despesa", amount: 100, category: "Moradia", subcategory: "Aluguel", responsible: "João Paulo", payment: "Conta conjunta", note: "" },
      { id: 2, date: "2026-07-05", type: "despesa", amount: 200, category: "Moradia", subcategory: "Aluguel", responsible: "Danieli", payment: "Conta conjunta", note: "" },
    ]} />);
    expect(screen.getByText("−50,0% em relação a julho")).toHaveClass("text-[#297059]");

    rerender(<DashboardView transactions={[
      { id: 1, date: "2026-08-05", type: "despesa", amount: 300, category: "Moradia", subcategory: "Aluguel", responsible: "João Paulo", payment: "Conta conjunta", note: "" },
      { id: 2, date: "2026-07-05", type: "despesa", amount: 200, category: "Moradia", subcategory: "Aluguel", responsible: "Danieli", payment: "Conta conjunta", note: "" },
    ]} />);
    expect(screen.getByText("+50,0% em relação a julho")).toHaveClass("text-[#a55348]");
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
    expect(responsible).toHaveValue("Ambos");
    const now = new Date();
    const localDate = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
    expect(screen.getByLabelText("Data")).toHaveValue(localDate);
    expect(screen.getByRole("option", { name: "João Paulo" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Danieli" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Você" })).not.toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Esposa" })).not.toBeInTheDocument();

    const payment = screen.getByRole("combobox", { name: "Forma de pagamento" });
    await user.selectOptions(payment, "Crédito");

    const installments = screen.getByRole("textbox", { name: "Quantidade de parcelas" });
    expect(installments).toHaveValue("1");
    await user.click(installments);
    expect(installments).toHaveValue("");
    await user.type(installments, "2");

    expect(installments).toHaveValue("2");
    expect(installments).not.toHaveValue("12");
  });

  it("oculta a forma de pagamento quando Receita é selecionada", async () => {
    const user = userEvent.setup();
    render(<NewTransaction onAdd={vi.fn()} categoriesData={categories} payments={["Crédito", "Pix"]} />);

    expect(screen.getByRole("combobox", { name: "Forma de pagamento" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Receita/i }));
    expect(screen.queryByRole("combobox", { name: "Forma de pagamento" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Despesa/i }));
    expect(screen.getByRole("combobox", { name: "Forma de pagamento" })).toBeInTheDocument();
  });
});
