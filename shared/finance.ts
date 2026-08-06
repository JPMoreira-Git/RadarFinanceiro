export type FinanceTransaction = {
  type: "receita" | "despesa";
  amount: number;
  subcategory: string;
};

export function canUseInstallments(payment: string) {
  const normalized = payment.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return normalized.includes("cartao") || normalized.includes("credito") || normalized.includes("pix");
}

export function shouldShowInstallments(type: "receita" | "despesa", _payment: string) {
  return type === "despesa";
}

export function updateInstallmentsInput(value: string) {
  return value;
}

export function normalizeInstallments(value: string | number, payment?: string) {
  if (payment && !canUseInstallments(payment)) return 1;
  return Math.max(1, Math.min(60, Number(value) || 1));
}

export type InstallmentTransactionInput = {
  idSeed: number;
  date: string;
  type: "receita" | "despesa";
  amount: number;
  category: string;
  subcategory: string;
  responsible: string;
  payment: string;
  note: string;
  installments: string | number;
};

export type InstallmentTransactionOutput = InstallmentTransactionInput & {
  id: number;
  date: string;
  amount: number;
  installmentGroupId?: string;
  installmentNumber?: number;
  installmentCount?: number;
};

export function splitInstallments(total: number, count: number) {
  const safeCount = Math.max(1, Math.floor(count));
  const cents = Math.round(total * 100);
  const base = Math.floor(cents / safeCount);
  const remainder = cents - base * safeCount;
  return Array.from({ length: safeCount }, (_, index) => (base + (index < remainder ? 1 : 0)) / 100);
}

export function buildInstallmentTransactions(input: InstallmentTransactionInput): InstallmentTransactionOutput[] {
  const count = normalizeInstallments(input.installments, input.payment);
  const values = splitInstallments(input.amount, count);
  const groupId = count > 1 ? `parcelado-${input.idSeed}` : undefined;
  return values.map((amount, index) => ({
    ...input,
    id: input.idSeed + index,
    date: installmentDate(input.date, index),
    amount,
    note: count > 1 ? `Parcela ${index + 1}/${count}${input.note ? ` · ${input.note}` : ""}` : input.note,
    installmentGroupId: groupId,
    installmentNumber: count > 1 ? index + 1 : undefined,
    installmentCount: count > 1 ? count : undefined,
  }));
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

const normalizeText = (value: string) => value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

export function isInvestmentIncome(subcategory: string) {
  const normalized = normalizeText(subcategory);
  return normalized.includes("rendimento") && normalized.includes("invest")
    || normalized === "rendimentos"
    || normalized === "rendimento";
}

export function aggregateMonthly<T extends { date: string; type: "receita" | "despesa"; amount: number; subcategory: string }>(transactions: T[], months: readonly (readonly [string, string])[]) {
  return months.map(([key, month]) => {
    const entries = transactions.filter((item) => item.date.startsWith(key));
    return {
      month,
      receita: entries.filter((item) => item.type === "receita").reduce((sum, item) => sum + item.amount, 0),
      investimentos: entries.filter((item) => item.type === "receita" && isInvestmentIncome(item.subcategory)).reduce((sum, item) => sum + item.amount, 0),
      gastos: entries.filter((item) => item.type === "despesa").reduce((sum, item) => sum + item.amount, 0),
    };
  });
}

export function removeTransactionScope<T extends { id: number; installmentGroupId?: string }>(transactions: T[], target: T, scope: "item" | "group") {
  return transactions.filter((item) => scope === "group" && target.installmentGroupId ? item.installmentGroupId !== target.installmentGroupId : item.id !== target.id);
}

export function reorderListItem<T>(items: readonly T[], fromIndex: number, toIndex: number) {
  if (fromIndex < 0 || toIndex < 0 || fromIndex >= items.length || toIndex >= items.length) return [...items];
  const next = [...items];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
}

export function reorderNamedEntries<T>(record: Record<string, T>, from: string, to: string) {
  const entries = Object.entries(record);
  const fromIndex = entries.findIndex(([name]) => name === from);
  const toIndex = entries.findIndex(([name]) => name === to);
  if (fromIndex < 0 || toIndex < 0) return { ...record };
  const reordered = reorderListItem(entries, fromIndex, toIndex);
  return Object.fromEntries(reordered);
}

export function renameListItem(items: readonly string[], oldName: string, newName: string) {
  const value = newName.trim();
  if (!value || value === oldName || items.includes(value)) return [...items];
  return items.map((item) => item === oldName ? value : item);
}

export function renameNamedEntry<T>(record: Record<string, T>, oldName: string, newName: string) {
  const value = newName.trim();
  if (!value || value === oldName || Object.prototype.hasOwnProperty.call(record, value)) return { ...record };
  const next: Record<string, T> = {};
  Object.entries(record).forEach(([name, item]) => { next[name === oldName ? value : name] = item; });
  return next;
}

export function canDeleteCategory<T extends { category: string }>(transactions: readonly T[], category: string) {
  return !transactions.some((item) => item.category === category);
}

export function canDeleteSubcategory<T extends { category: string; subcategory: string }>(transactions: readonly T[], category: string, subcategory: string) {
  return !transactions.some((item) => item.category === category && item.subcategory === subcategory);
}

export function summarizeTransactions(transactions: FinanceTransaction[]) {
  const receita = transactions
    .filter((item) => item.type === "receita")
    .reduce((sum, item) => sum + item.amount, 0);
  const despesas = transactions
    .filter((item) => item.type === "despesa")
    .reduce((sum, item) => sum + item.amount, 0);
  const investimentos = transactions
    .filter((item) => item.type === "receita" && isInvestmentIncome(item.subcategory))
    .reduce((sum, item) => sum + item.amount, 0);

  return {
    receita,
    despesas,
    investimentos,
    saldo: receita - despesas,
    cobertura: despesas === 0 ? 0 : (investimentos / despesas) * 100,
  };
}
