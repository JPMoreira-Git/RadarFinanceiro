export type FinanceTransaction = {
  type: "receita" | "despesa";
  amount: number;
  subcategory: string;
};

export function splitInstallments(total: number, count: number) {
  const safeCount = Math.max(1, Math.floor(count));
  const cents = Math.round(total * 100);
  const base = Math.floor(cents / safeCount);
  const remainder = cents - base * safeCount;
  return Array.from({ length: safeCount }, (_, index) => (base + (index < remainder ? 1 : 0)) / 100);
}

export function installmentDate(firstDate: string, index: number) {
  const date = new Date(`${firstDate}T12:00:00`);
  date.setMonth(date.getMonth() + index);
  return date.toISOString().slice(0, 10);
}

export function filterTransactions<T extends { date: string; category: string; responsible: string; payment: string }>(transactions: T[], options: { month?: string; category?: string; responsible?: string; payment?: string }) {
  return transactions.filter((item) =>
    (!options.month || item.date.startsWith(options.month)) &&
    (!options.category || options.category === "Todos" || item.category === options.category) &&
    (!options.responsible || options.responsible === "Todos" || item.responsible === options.responsible) &&
    (!options.payment || options.payment === "Todos" || item.payment === options.payment),
  );
}

export function aggregateMonthly<T extends { date: string; type: "receita" | "despesa"; amount: number; subcategory: string }>(transactions: T[], months: readonly (readonly [string, string])[]) {
  return months.map(([key, month]) => {
    const entries = transactions.filter((item) => item.date.startsWith(key));
    return {
      month,
      receita: entries.filter((item) => item.type === "receita").reduce((sum, item) => sum + item.amount, 0),
      investimentos: entries.filter((item) => item.subcategory === "Rendimento de investimentos").reduce((sum, item) => sum + item.amount, 0),
      gastos: entries.filter((item) => item.type === "despesa").reduce((sum, item) => sum + item.amount, 0),
    };
  });
}

export function removeTransactionScope<T extends { id: number; installmentGroupId?: string }>(transactions: T[], target: T, scope: "item" | "group") {
  return transactions.filter((item) => scope === "group" && target.installmentGroupId ? item.installmentGroupId !== target.installmentGroupId : item.id !== target.id);
}

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
