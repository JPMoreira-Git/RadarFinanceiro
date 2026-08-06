export type FinanceTransaction = {
  type: "receita" | "despesa";
  amount: number;
  subcategory: string;
};

export function summarizeTransactions(transactions: FinanceTransaction[]) {
  const receita = transactions
    .filter((item) => item.type === "receita")
    .reduce((sum, item) => sum + item.amount, 0);
  const despesas = transactions
    .filter((item) => item.type === "despesa")
    .reduce((sum, item) => sum + item.amount, 0);
  const investimentos = transactions
    .filter((item) => item.subcategory === "Rendimento de investimentos")
    .reduce((sum, item) => sum + item.amount, 0);

  return {
    receita,
    despesas,
    investimentos,
    saldo: receita - despesas,
    cobertura: despesas === 0 ? 0 : (investimentos / despesas) * 100,
  };
}
