import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import React, { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { aggregateMonthly, buildInstallmentTransactions, canDeleteCategory, canDeleteSubcategory, canUseInstallments, filterTransactions, normalizeInstallments, removeTransactionScope, updateInstallmentsInput, renameListItem, renameNamedEntry, reorderListItem, reorderNamedEntries, shouldShowInstallments, splitInstallments, summarizeTransactions, isInvestmentIncome } from "@shared/finance";
import { usePersistentState } from "@/hooks/usePersistentState";
import { trpc } from "@/lib/trpc";
import CategoryManager from "@/components/CategoryManager";
import InstallmentField from "@/components/InstallmentField";
import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  LabelList,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Ellipsis,
  Filter,
  ListFilter,
  Pencil,
  Plus,
  ReceiptText,
  Settings2,
  Sparkles,
  Trash2,
  TrendingUp,
  Wallet,
  X,
} from "lucide-react";

type TransactionType = "receita" | "despesa";
type Transaction = {
  id: number;
  date: string;
  type: TransactionType;
  amount: number;
  category: string;
  subcategory: string;
  responsible: string;
  payment: string;
  note: string;
  installmentGroupId?: string;
  installmentNumber?: number;
  installmentCount?: number;
};

const categories: Record<string, string[]> = {
  Moradia: ["Aluguel", "Condomínio", "IPTU", "Manutenção"],
  Transporte: ["Combustível", "Seguro", "Manutenção", "Transporte público"],
  Alimentação: ["Supermercado", "Restaurante", "Delivery"],
  "Saúde e Bem-estar": ["Plano de saúde", "Farmácia", "Academia", "Consultas"],
  Lazer: ["Viagens", "Entretenimento", "Assinaturas"],
  "Ajuda Familiar": ["Pais", "Sogros"],
  Investimentos: ["Aporte", "Resgate"],
  Receitas: ["Salário", "Rendimento de investimentos", "Outros"],
};

type RemoteTransactionRow = {
  id: number;
  descricao: string;
  valor: number;
  data: string;
  tipo: string;
  forma_pagamento: string | null;
  parcelas: number | null;
  responsavel: string;
};

export function normalizeRemoteTransactionType(value: unknown): TransactionType {
  const normalized = String(value ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return normalized === "receita" || normalized === "income" || normalized === "entrada" ? "receita" : "despesa";
}

export function mapSupabaseTransaction(row: RemoteTransactionRow): Transaction {
  const [category = "Outros", subcategory = "Geral", ...noteParts] = row.descricao.split(" · ");
  return {
    id: Number(row.id),
    date: String(row.data).slice(0, 10),
    type: normalizeRemoteTransactionType(row.tipo),
    amount: Number(row.valor),
    category,
    subcategory,
    responsible: row.responsavel,
    payment: row.forma_pagamento ?? "",
    note: noteParts.join(" · "),
    installmentCount: row.parcelas ?? undefined,
  };
}

export function resolveTransactions(remoteRows: RemoteTransactionRow[] | undefined, localTransactions: Transaction[]) {
  return remoteRows === undefined ? localTransactions : remoteRows.map(mapSupabaseTransaction);
}

export function handleDeleteError(error: unknown) {
  const message = error instanceof Error ? error.message : "Não foi possível excluir o lançamento.";
  window.alert(message);
  toast.error(message);
  return message;
}

export async function deleteTransactionRemotely(id: number, mutation: { mutateAsync: (input: { id: number }) => Promise<unknown> }, onSuccess: () => void, refetch: () => Promise<unknown>) {
  try {
    await mutation.mutateAsync({ id });
    await refetch();
    onSuccess();
    toast.success("Lançamento removido.");
  } catch (error) {
    handleDeleteError(error);
  }
}

export async function deleteTransactionsRemotely(ids: number[], mutation: { mutateAsync: (input: { ids: number[] }) => Promise<unknown> }, onSuccess: () => void, refetch: () => Promise<unknown>) {
  try {
    if (ids.length === 0) throw new Error("Nenhuma parcela válida para excluir.");
    await mutation.mutateAsync({ ids });
    await refetch();
    onSuccess();
    toast.success("Compra parcelada removida.");
  } catch (error) {
    handleDeleteError(error);
  }
}

export function transactionMonthOptions(transactions: Transaction[]) {
  return Array.from(new Set(transactions.map((item) => item.date.slice(0, 7)).filter((month) => /^\d{4}-\d{2}$/.test(month))))
    .sort((a, b) => b.localeCompare(a))
    .map((value) => { const name = monthLabel(value); return { value, label: `${name.charAt(0).toUpperCase()}${name.slice(1)} ${value.slice(0, 4)}` }; });
}

const seedTransactions: Transaction[] = [
  { id: 1, date: "2026-08-05", type: "despesa", amount: 482.7, category: "Alimentação", subcategory: "Supermercado", responsible: "João Paulo", payment: "Cartão principal", note: "Compras da semana" },
  { id: 2, date: "2026-08-04", type: "receita", amount: 1640, category: "Receitas", subcategory: "Rendimento de investimentos", responsible: "João Paulo", payment: "Conta investimentos", note: "Rendimento mensal" },
  { id: 3, date: "2026-08-03", type: "despesa", amount: 285.9, category: "Moradia", subcategory: "Condomínio", responsible: "Danieli", payment: "Débito automático", note: "" },
  { id: 4, date: "2026-08-02", type: "despesa", amount: 197.5, category: "Saúde e Bem-estar", subcategory: "Academia", responsible: "Danieli", payment: "Cartão principal", note: "Mensalidade" },
  { id: 5, date: "2026-08-01", type: "receita", amount: 9200, category: "Receitas", subcategory: "Salário", responsible: "Danieli", payment: "Conta conjunta", note: "Salário mensal" },
  { id: 6, date: "2026-07-28", type: "despesa", amount: 620, category: "Transporte", subcategory: "Combustível", responsible: "João Paulo", payment: "Cartão principal", note: "" },
  { id: 7, date: "2026-07-25", type: "receita", amount: 8900, category: "Receitas", subcategory: "Salário", responsible: "João Paulo", payment: "Conta conjunta", note: "Salário mensal" },
  { id: 8, date: "2026-07-20", type: "despesa", amount: 2400, category: "Moradia", subcategory: "Aluguel", responsible: "João Paulo", payment: "Conta conjunta", note: "" },
  { id: 9, date: "2026-07-15", type: "receita", amount: 1580, category: "Receitas", subcategory: "Rendimento de investimentos", responsible: "João Paulo", payment: "Conta investimentos", note: "Rendimento mensal" },
];

const waterfallMonths = [
  ["2026-01", "Jan"], ["2026-02", "Fev"], ["2026-03", "Mar"], ["2026-04", "Abr"],
  ["2026-05", "Mai"], ["2026-06", "Jun"], ["2026-07", "Jul"], ["2026-08", "Ago"],
] as const;

function monthKeyFromDate(date: string) {
  return date.slice(0, 7);
}

function shiftMonth(key: string, offset: number) {
  const [year, month] = key.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1 + offset, 1));
  return date.toISOString().slice(0, 7);
}

function monthLabel(key: string) {
  return new Date(`${key}-15T12:00:00`).toLocaleDateString("pt-BR", { month: "long" });
}

function latestTransactionMonth(transactions: Transaction[]) {
  const months = transactions.map((item) => monthKeyFromDate(item.date));
  return months.length > 0 ? months.reduce((latest, month) => month > latest ? month : latest) : new Date().toISOString().slice(0, 7);
}

function buildDashboardMonths(endMonth: string) {
  return Array.from({ length: 6 }, (_, index) => {
    const key = shiftMonth(endMonth, index - 5);
    return [key, new Date(`${key}-15T12:00:00`).toLocaleDateString("pt-BR", { month: "short" }).replace(".", "")] as const;
  });
}

export function buildDashboardChartData(transactions: Transaction[], endMonth: string) {
  return aggregateMonthly(transactions, buildDashboardMonths(endMonth));
}

export function buildInvestmentExpenseWaterfall(transactions: Transaction[]) {
  const monthly = aggregateMonthly(transactions, waterfallMonths);
  let accumulated = 0;
  const monthlySteps = monthly.map((item) => {
    const value = item.investimentos - item.gastos;
    accumulated += value;
    return { label: item.month, value, tone: value >= 0 ? "positive" as const : "negative" as const };
  });
  return [...monthlySteps, { label: "Acumulado", value: accumulated, tone: accumulated >= 0 ? "positive" as const : "negative" as const, isTotal: true as const }];
}

export function buildIncomeExpenseWaterfall(transactions: Transaction[]) {
  const monthly = aggregateMonthly(transactions, waterfallMonths);
  let accumulated = 0;
  const monthlySteps = monthly.map((item) => {
    const value = item.receita - item.gastos;
    accumulated += value;
    return { label: item.month, value, tone: value >= 0 ? "positive" as const : "negative" as const };
  });
  return [...monthlySteps, { label: "Acumulado", value: accumulated, tone: accumulated >= 0 ? "positive" as const : "negative" as const, isTotal: true as const }];
}

const currency = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dateLabel = (value: string) => new Date(`${value}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }).replace(" de ", "/");
const todayInputValue = () => { const now = new Date(); const localDate = new Date(now.getTime() - now.getTimezoneOffset() * 60000); return localDate.toISOString().slice(0, 10); };
const compactCurrency = (value: number) => `R$${Math.round(value).toLocaleString("pt-BR")}`;
const chartLabel = (value: number) => value === 0 ? "" : Math.round(Math.abs(value)).toLocaleString("pt-BR");
export const percentageChange = (current: number, previous: number) => previous === 0 ? null : ((current - previous) / previous) * 100;

function StatCard({ label, value, detail, detailClassName, tone, icon: Icon }: { label: string; value: string; detail: string; detailClassName?: string; tone: "green" | "sand" | "rose" | "blue"; icon: typeof Wallet }) {
  const tones = {
    green: "bg-[#e6f1eb] text-[#1b5b49]",
    sand: "bg-[#f5ecdf] text-[#98633c]",
    rose: "bg-[#f8e8e5] text-[#a55348]",
    blue: "bg-[#e8eff2] text-[#376273]",
  };
  return <Card className="rounded-2xl border-[#e0e9e3] bg-white shadow-[0_8px_30px_rgba(30,62,48,0.04)]"><CardContent className="p-4 sm:p-5"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#8b9c94]">{label}</p><p className="mt-2 font-display text-xl font-semibold tracking-tight text-[#173f35] sm:text-2xl">{value}</p></div><div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${tones[tone]}`}><Icon className="h-4 w-4" /></div></div><p className={`mt-3 text-xs ${detailClassName ?? "text-[#81918a]"}`}>{detail}</p></CardContent></Card>;
}

function SectionHeading({ eyebrow, title, action }: { eyebrow?: string; title: string; action?: React.ReactNode }) {
  return <div className="mb-4 flex items-end justify-between gap-4"><div>{eyebrow && <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.19em] text-[#a16d45]">{eyebrow}</p>}<h2 className="font-display text-xl font-semibold tracking-tight text-[#173f35]">{title}</h2></div>{action}</div>;
}

export function financialChartY(value: number, maxValue: number, plotTop = 24, plotBottom = 228) {
  return plotBottom - (value / Math.max(maxValue, 1)) * (plotBottom - plotTop);
}

export function financialChartBarY(value: number, maxValue: number, plotTop = 24, plotBottom = 228) {
  return financialChartY(value, maxValue, plotTop, plotBottom);
}

export function financialChartLineY(value: number, maxValue: number, plotTop = 24, plotBottom = 228) {
  return financialChartY(value, maxValue, plotTop, plotBottom);
}

export function lineLabelOffsets(investmentY: number, expenseY: number) {
  const investmentsAbove = investmentY <= expenseY;
  return {
    investments: investmentsAbove ? -8 : 16,
    expenses: investmentsAbove ? 16 : -8,
  };
}

export function FinancialRhythmChart({ data }: { data: { month: string; receita: number; investimentos: number; gastos: number }[] }) {
  const width = 720;
  const height = 290;
  const plotLeft = 44;
  const plotRight = width - 18;
  const plotTop = 24;
  const plotBottom = 228;
  const maxBar = Math.max(...data.map((item) => item.receita), 1);
  const x = (index: number) => plotLeft + (index * (plotRight - plotLeft)) / Math.max(data.length - 1, 1);
  const yBar = (value: number) => financialChartBarY(value, maxBar, plotTop, plotBottom);
  const yLine = (value: number) => financialChartLineY(value, maxBar, plotTop, plotBottom);
  const linePath = (key: "investimentos" | "gastos") => data.map((item, index) => `${index === 0 ? "M" : "L"} ${x(index)} ${yLine(item[key])}`).join(" ");
  const areaPath = (key: "investimentos" | "gastos") => `${linePath(key)} L ${x(data.length - 1)} ${plotBottom} L ${x(0)} ${plotBottom} Z`;
  return <div className="w-full" aria-label="Ritmo financeiro mensal"><svg viewBox={`0 0 ${width} ${height}`} className="h-[290px] w-full" role="img" aria-label="Receita Total, Investimentos e Despesas por mês"><line x1={plotLeft} x2={plotRight} y1={plotBottom} y2={plotBottom} stroke="#dfe9e2" /><line x1={plotLeft} x2={plotRight} y1={plotTop} y2={plotTop} stroke="#edf1ee" /><line x1={plotLeft} x2={plotRight} y1={(plotTop + plotBottom) / 2} y2={(plotTop + plotBottom) / 2} stroke="#edf1ee" /><text x="8" y={plotTop + 4} fill="#91a098" fontSize="10">{compactCurrency(maxBar)}</text><text x="12" y={(plotTop + plotBottom) / 2 + 4} fill="#91a098" fontSize="10">{compactCurrency(maxBar / 2)}</text>{data.map((item, index) => <g key={item.month}><rect x={x(index) - 16} y={yBar(item.receita)} width="32" height={Math.max(0, plotBottom - yBar(item.receita))} rx="7" fill="#cfe5d9" /><text x={x(index)} y={item.receita === 0 ? plotBottom - 8 : yBar(item.receita) - 8} textAnchor="middle" fill="#297059" fontSize="10" fontWeight="700">{chartLabel(item.receita)}</text><text x={x(index)} y="252" textAnchor="middle" fill="#91a098" fontSize="11">{item.month}</text></g>)}<path d={areaPath("investimentos")} fill="#8fc4a5" fillOpacity="0.2" /><path d={areaPath("gastos")} fill="#e5a59a" fillOpacity="0.16" /><path d={linePath("investimentos")} fill="none" stroke="#3f8b63" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /><path d={linePath("gastos")} fill="none" stroke="#c4685a" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />{data.map((item, index) => { const investmentY = yLine(item.investimentos); const expenseY = yLine(item.gastos); const offsets = lineLabelOffsets(investmentY, expenseY); return <g key={`points-${item.month}`}><circle cx={x(index)} cy={investmentY} r="4" fill="#3f8b63" /><circle cx={x(index)} cy={expenseY} r="4" fill="#c4685a" />{item.investimentos > 0 && <text x={x(index)} y={investmentY + offsets.investments} textAnchor="middle" fill="#3f8b63" fontSize="10" fontWeight="700">{chartLabel(item.investimentos)}</text>}{item.gastos > 0 && <text x={x(index)} y={expenseY + offsets.expenses} textAnchor="middle" fill="#a55348" fontSize="10" fontWeight="700">{chartLabel(item.gastos)}</text>}</g>; })} </svg><div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 pt-1 text-[11px] text-[#71847a]"><span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-[3px] bg-[#cfe5d9]" />Receita Total</span><span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-[#3f8b63]" />Investimentos</span><span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-[#a85f50]" />Despesas</span></div></div>;
}

export function DashboardView({ transactions, selectedMonth: selectedMonthOverride, onMonthChange }: { transactions: Transaction[]; selectedMonth?: string; onMonthChange?: (month: string) => void }) {
  const selectedMonth = selectedMonthOverride ?? latestTransactionMonth(transactions);
  const previousMonth = shiftMonth(selectedMonth, -1);
  const monthTransactions = transactions.filter((item) => item.date.startsWith(selectedMonth));
  const previousMonthTransactions = transactions.filter((item) => item.date.startsWith(previousMonth));
  const { receita, despesas, investimentos, cobertura: coverage } = summarizeTransactions(monthTransactions);
  const { receita: previousReceita, despesas: previousExpenses } = summarizeTransactions(previousMonthTransactions);
  const revenueChange = percentageChange(receita, previousReceita);
  const expensesChange = percentageChange(despesas, previousExpenses);
  const salary = monthTransactions.filter((item) => item.subcategory.toLowerCase() === "salário").reduce((sum, item) => sum + item.amount, 0);
  const chartTransactions = transactions.map((item) => ({ ...item, type: item.type === "receita" ? "receita" as const : "despesa" as const, amount: Number(item.amount) }));
  const monthlyData = buildDashboardChartData(chartTransactions, selectedMonth);
  const investmentExpenseWaterfall = buildInvestmentExpenseWaterfall(transactions);
  const incomeExpenseWaterfall = buildIncomeExpenseWaterfall(transactions);
  const recent = monthTransactions.slice(0, 4);

  return <div className="mx-auto max-w-[1400px] px-4 py-5 sm:px-6 lg:px-8 lg:py-8"><div className="mb-7 flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><p className="mb-2 text-[11px] font-bold uppercase tracking-[0.2em] text-[#a16d45]">{monthLabel(selectedMonth)} {selectedMonth.slice(0, 4)}</p><h1 className="font-display text-3xl font-semibold tracking-[-0.04em] text-[#173f35] sm:text-4xl">Visão geral do mês</h1><p className="mt-2 max-w-xl text-sm leading-6 text-[#77877f]">Acompanhe o fluxo da família e veja se os rendimentos já cobrem o custo de viver bem.</p></div><div className="flex items-center gap-2"><Button variant="outline" onClick={() => onMonthChange?.(previousMonth)} aria-label={`Selecionar ${monthLabel(previousMonth)}`} className="h-10 rounded-xl border-[#d7e1db] bg-white text-[#557067] hover:bg-[#f0f5f2]"><ChevronLeft className="mr-1 h-4 w-4" />{monthLabel(previousMonth)}</Button><span className="hidden h-10 items-center rounded-xl bg-[#edf5ef] px-3 text-sm font-semibold capitalize text-[#31584b] sm:flex">{monthLabel(selectedMonth)}</span><Button variant="outline" onClick={() => onMonthChange?.(shiftMonth(selectedMonth, 1))} aria-label={`Selecionar ${monthLabel(shiftMonth(selectedMonth, 1))}`} className="h-10 rounded-xl border-[#d7e1db] bg-white text-[#557067] hover:bg-[#f0f5f2]">{monthLabel(shiftMonth(selectedMonth, 1))}<ChevronRight className="ml-1 h-4 w-4" /></Button></div></div><div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4"><StatCard label="Receitas" value={currency(receita)} detail={revenueChange === null ? "Sem base para comparação" : `${revenueChange >= 0 ? "+" : "−"}${Math.abs(revenueChange).toFixed(1).replace(".", ",")}% em relação a ${monthLabel(previousMonth)}`} detailClassName={revenueChange === null ? undefined : revenueChange < 0 ? "text-[#a55348]" : "text-[#297059]"} tone="green" icon={ArrowUpRight} /><StatCard label="Despesas" value={currency(despesas)} detail={expensesChange === null ? "Sem base para comparação" : `${expensesChange >= 0 ? "+" : "−"}${Math.abs(expensesChange).toFixed(1).replace(".", ",")}% em relação a ${monthLabel(previousMonth)}`} detailClassName={expensesChange === null ? undefined : expensesChange < 0 ? "text-[#297059]" : expensesChange > 0 ? "text-[#a55348]" : "text-[#81918a]"} tone="rose" icon={ArrowDownRight} /><StatCard label="Saldo do mês" value={currency(receita - despesas)} detail="Disponível após as saídas" tone="sand" icon={CircleDollarSign} /><StatCard label="Cobertura" value={`${coverage.toFixed(0)}%`} detail="Rendimentos vs. despesas" tone="blue" icon={TrendingUp} /></div><div className="mt-6 grid gap-5 xl:grid-cols-[1.45fr_0.55fr]"><Card className="rounded-2xl border-[#e0e9e3] bg-white shadow-[0_8px_30px_rgba(30,62,48,0.04)]"><CardHeader className="border-b border-[#edf1ee] p-5 pb-4 sm:p-6 sm:pb-4"><div className="flex items-center justify-between gap-3"><CardTitle className="font-display text-xl text-[#173f35]">Ritmo financeiro</CardTitle><div className="flex items-center gap-2 rounded-xl bg-[#f5f8f5] px-3 py-2 text-xs text-[#71847a]"><span className="h-2 w-2 rounded-full bg-[#a16d45]" /> Atualizado agora</div></div></CardHeader><CardContent className="p-3 pt-5 sm:p-6"><FinancialRhythmChart data={monthlyData} /></CardContent></Card><div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-1"><Card className="rounded-2xl border-[#e0e9e3] bg-[#173f35] text-white shadow-[0_12px_35px_rgba(23,63,53,0.13)]"><CardContent className="p-5 sm:p-6"><div className="flex items-start justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#b9d4c6]">Rendimento</p><p className="mt-2 font-display text-3xl font-semibold">{currency(investimentos)}</p></div><div className="rounded-xl bg-white/10 p-2.5"><Sparkles className="h-5 w-5 text-[#e7c7a7]" /></div></div><div className="mt-6"><div className="mb-2 flex justify-between text-xs text-[#c2d6cb]"><span>Cobertura das despesas</span><span>{coverage.toFixed(0)}%</span></div><div className="h-2 overflow-hidden rounded-full bg-white/15"><div className="h-full rounded-full bg-[#d6a77b]" style={{ width: `${Math.min(coverage, 100)}%` }} /></div></div><p className="mt-4 text-xs leading-5 text-[#b9d4c6]">Faltam {currency(Math.max(despesas - investimentos, 0))} para os investimentos cobrirem todas as saídas.</p></CardContent></Card><Card className="rounded-2xl border-[#e0e9e3] bg-white shadow-[0_8px_30px_rgba(30,62,48,0.04)]"><CardContent className="p-5"><div className="mb-4 flex items-center justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#a16d45]">Atividade</p><h3 className="mt-1 font-display text-lg font-semibold text-[#173f35]">Últimos lançamentos</h3></div><ReceiptText className="h-5 w-5 text-[#9a6b43]" /></div><div className="space-y-3">{recent.length > 0 ? recent.map((item) => <div key={item.id} className="flex items-center gap-3"><div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${item.type === "receita" ? "bg-[#e6f1eb] text-[#297059]" : "bg-[#f8e8e5] text-[#a55348]"}`}>{item.type === "receita" ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}</div><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-[#31584b]">{item.subcategory}</p><p className="text-[11px] text-[#96a49d]">{dateLabel(item.date)} · {item.responsible}</p></div><p className={`text-sm font-semibold ${item.type === "receita" ? "text-[#297059]" : "text-[#a55348]"}`}>{item.type === "receita" ? "+" : "−"}{currency(item.amount)}</p></div>) : <p className="rounded-xl bg-[#f5f8f5] p-3 text-xs leading-5 text-[#81918a]">Nenhum lançamento em {monthLabel(selectedMonth)}.</p>}</div></CardContent></Card></div></div><div className="mt-6 grid gap-5 xl:grid-cols-2"><DivergingBalanceCard title="Investimentos x Despesas" values={investmentExpenseWaterfall.filter((item) => !("isTotal" in item && item.isTotal)).map((item) => ({ label: item.label, value: item.value }))} /><DivergingBalanceCard title="Renda Total x Despesas" values={incomeExpenseWaterfall.filter((item) => !("isTotal" in item && item.isTotal)).map((item) => ({ label: item.label, value: item.value }))} /></div></div>;
}

export function divergingBarY(value: number, max: number, center = 82, amplitude = 58) {
  return center - (value / Math.max(Math.abs(max), 1)) * amplitude;
}

export function DivergingBalanceCard({ title, values }: { title: string; values: { label: string; value: number; isTotal?: boolean }[] }) {
  const max = Math.max(...values.map((item) => Math.abs(item.value)), 1);
  const accumulated = values.find((item) => item.isTotal)?.value ?? values.reduce((sum, item) => sum + item.value, 0);
  const center = 82;
  const amplitude = 58;
  const y = (value: number) => divergingBarY(value, max, center, amplitude);
  return <Card className="rounded-2xl border-[#e0e9e3] bg-white shadow-[0_8px_30px_rgba(30,62,48,0.04)]"><CardHeader className="p-5 pb-2"><CardTitle className="font-display text-lg text-[#173f35]">{title}</CardTitle></CardHeader><CardContent className="p-5 pt-2"><div className="h-48 w-full"><svg viewBox="0 0 620 190" className="h-full w-full" role="img" aria-label={`${title}: saldo mensal`}><line x1="18" x2="602" y1={center} y2={center} stroke="#b8c9bf" strokeDasharray="4 5" />{values.map((item, index) => { const x = 42 + index * (540 / Math.max(values.length, 1)); const valueY = y(item.value); const top = Math.min(center, valueY); const height = Math.max(Math.abs(center - valueY), item.value === 0 ? 0 : 8); const color = item.isTotal ? (item.value >= 0 ? "#6d9b83" : "#bc6d63") : item.value >= 0 ? "#9bc9aa" : "#d8897d"; const textColor = item.value >= 0 ? "#297059" : "#a55348"; return <g key={item.label}><rect x={x} y={top} width="76" height={height} rx="9" fill={color} /><text x={x + 38} y={item.value >= 0 ? top - 8 : top + height + 16} textAnchor="middle" fontSize="11" fontWeight="700" fill={textColor}>{chartLabel(item.value)}</text><text x={x + 38} y="170" textAnchor="middle" fontSize="10" fill="#788a81">{item.label}</text></g>; })}</svg></div><div className="mt-2 flex items-center justify-between rounded-xl bg-[#f5f8f5] px-3 py-2"><span className="text-xs font-semibold text-[#788a81]">Resultado acumulado</span><span className={`text-xs font-bold ${accumulated >= 0 ? "text-[#297059]" : "text-[#a55348]"}`}>{accumulated >= 0 ? "+" : "−"}{currency(Math.abs(accumulated))}</span></div></CardContent></Card>;
}

function WaterfallCard({ title, eyebrow, values }: { title: string; eyebrow?: string; values: { label: string; value: number; tone: "positive" | "negative"; isTotal?: boolean }[] }) {
  let cumulative = 0;
  const steps = values.map((item) => {
    if (item.isTotal) return { ...item, start: 0, end: item.value };
    const start = cumulative;
    cumulative += item.value;
    return { ...item, start, end: cumulative };
  });
  const result = values.find((item) => item.isTotal)?.value ?? cumulative;
  const max = Math.max(...steps.flatMap((item) => [Math.abs(item.start), Math.abs(item.end)]), 1);
  const scale = (value: number) => 132 - ((value + max) / (max * 2)) * 116;
  return <Card className="rounded-2xl border-[#e0e9e3] bg-white shadow-[0_8px_30px_rgba(30,62,48,0.04)]"><CardHeader className="p-5 pb-2">{eyebrow && <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#a16d45]">{eyebrow}</p>}<CardTitle className="mt-1 font-display text-lg text-[#173f35]">{title}</CardTitle></CardHeader><CardContent className="p-5 pt-2"><div className="h-48 w-full"><svg viewBox="0 0 620 190" className="h-full w-full" role="img" aria-label={title}><line x1="18" x2="602" y1={scale(0)} y2={scale(0)} stroke="#dfe9e2" strokeDasharray="4 5" />{steps.map((item, index) => { const x = 42 + index * (540 / steps.length); const top = scale(Math.max(item.start, item.end)); const bottom = scale(Math.min(item.start, item.end)); const height = Math.max(12, bottom - top); return <g key={item.label}><rect x={x} y={top} width={76} height={height} rx={9} fill={item.tone === "positive" ? "#b7d9c5" : "#edbcb5"} /><text x={x + 38} y={top - 8} textAnchor="middle" fontSize="11" fontWeight="700" fill={item.tone === "positive" ? "#297059" : "#a55348"}>{chartLabel(item.value)}</text><text x={x + 38} y="170" textAnchor="middle" fontSize="10" fill="#788a81">{item.label}</text>{index < steps.length - 1 && <line x1={x + 76} x2={x + 540 / steps.length} y1={scale(item.end)} y2={scale(item.end)} stroke="#b8c9bf" strokeDasharray="3 4" />}</g>; })}</svg></div><div className="mt-2 flex items-center justify-between rounded-xl bg-[#f5f8f5] px-3 py-2"><span className="text-xs font-semibold text-[#788a81]">Resultado acumulado</span><span className={`text-sm font-bold ${result >= 0 ? "text-[#297059]" : "text-[#a55348]"}`}>{result >= 0 ? "+" : "−"}{currency(Math.abs(result))}</span></div></CardContent></Card>;
}

export function NewTransaction({ onAdd, categoriesData, payments }: { onAdd: (transactions: Transaction[]) => void | Promise<unknown>; categoriesData: Record<string, string[]>; payments: string[] }) {
  const [form, setForm] = useState({ date: todayInputValue(), type: "despesa" as TransactionType, amount: "", category: "Moradia", subcategory: "Aluguel", responsible: "Ambos", payment: "Conta conjunta", note: "", installments: "1" });
  const availableCategories = form.type === "receita" ? { Receitas: categoriesData.Receitas ?? [] } : Object.fromEntries(Object.entries(categoriesData).filter(([name]) => name !== "Receitas"));
  const update = (key: string, value: string) => setForm((current) => {
    if (key === "type") {
      const nextCategories = value === "receita" ? { Receitas: categoriesData.Receitas ?? [] } : Object.fromEntries(Object.entries(categoriesData).filter(([name]) => name !== "Receitas"));
      const nextCategory = Object.keys(nextCategories)[0] ?? "";
      return { ...current, type: value as TransactionType, category: nextCategory, subcategory: nextCategories[nextCategory]?.[0] ?? "" };
    }
    return { ...current, [key]: value, ...(key === "category" ? { subcategory: categoriesData[value]?.[0] ?? "" } : {}) };
  });
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const amount = Number(form.amount.replace(",", "."));
    const installments = normalizeInstallments(form.installments);
    if (!amount || amount <= 0) { toast.error("Informe um valor válido para o lançamento."); return; }
    const created = buildInstallmentTransactions({ idSeed: Date.now(), date: form.date, type: form.type, amount, category: form.category, subcategory: form.subcategory, responsible: form.responsible, payment: form.payment, note: form.note, installments });
    try {
      await onAdd(created);
      toast.success(installments > 1 ? `Compra dividida em ${installments} parcelas.` : "Lançamento adicionado ao resumo.");
      setForm((current) => ({ ...current, amount: "", note: "", installments: "1" }));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível salvar o lançamento.");
    }
  };
  return <div className="mx-auto max-w-3xl px-4 py-5 sm:px-6 lg:py-8"><div className="mb-7"><p className="mb-2 text-[11px] font-bold uppercase tracking-[0.2em] text-[#a16d45]">Novo registro</p><h1 className="font-display text-3xl font-semibold tracking-[-0.04em] text-[#173f35]">O que aconteceu hoje?</h1><p className="mt-2 text-sm text-[#77877f]">Registre uma entrada ou saída para manter o fluxo da família atualizado.</p></div><form onSubmit={submit} className="space-y-5"><Card className="rounded-2xl border-[#e0e9e3] bg-white shadow-[0_8px_30px_rgba(30,62,48,0.04)]"><CardContent className="space-y-5 p-5 sm:p-7"><div><p className="mb-3 text-xs font-bold uppercase tracking-[0.14em] text-[#71847a]">Tipo de lançamento</p><div className="grid grid-cols-2 gap-3"><button type="button" onClick={() => update("type", "despesa")} className={`rounded-xl border p-4 text-left transition-all ${form.type === "despesa" ? "border-[#c4685a] bg-[#fcf0ee] text-[#a55348]" : "border-[#e0e9e3] bg-white text-[#82918a]"}`}><ArrowDownRight className="mb-3 h-5 w-5" /><p className="text-sm font-semibold">Despesa</p><p className="mt-1 text-xs opacity-70">Algo que saiu</p></button><button type="button" onClick={() => update("type", "receita")} className={`rounded-xl border p-4 text-left transition-all ${form.type === "receita" ? "border-[#73a88e] bg-[#edf6f0] text-[#297059]" : "border-[#e0e9e3] bg-white text-[#82918a]"}`}><ArrowUpRight className="mb-3 h-5 w-5" /><p className="text-sm font-semibold">Receita</p><p className="mt-1 text-xs opacity-70">Algo que entrou</p></button></div></div><div className="grid gap-4 sm:grid-cols-2"><Field label="Valor"><Input value={form.amount} onChange={(event) => update("amount", event.target.value)} inputMode="decimal" placeholder="0,00" className="h-12 rounded-xl border-[#dfe9e2] bg-[#fbfcfb] text-lg font-semibold text-[#173f35]" /></Field><Field label="Data"><Input type="date" value={form.date} onChange={(event) => update("date", event.target.value)} className="h-12 rounded-xl border-[#dfe9e2] bg-[#fbfcfb] text-[#31584b]" /></Field><Field label="Categoria"><select value={form.category} onChange={(event) => update("category", event.target.value)} className="h-12 w-full rounded-xl border border-[#dfe9e2] bg-[#fbfcfb] px-3 text-sm text-[#31584b] outline-none focus:border-[#9a6b43]">{Object.keys(availableCategories).map((item) => <option key={item}>{item}</option>)}</select></Field><Field label="Subcategoria"><select value={form.subcategory} onChange={(event) => update("subcategory", event.target.value)} className="h-12 w-full rounded-xl border border-[#dfe9e2] bg-[#fbfcfb] px-3 text-sm text-[#31584b] outline-none focus:border-[#9a6b43]">{(availableCategories[form.category] ?? []).map((item) => <option key={item}>{item}</option>)}</select></Field><Field label="Responsável"><select value={form.responsible} onChange={(event) => update("responsible", event.target.value)} className="h-12 w-full rounded-xl border border-[#dfe9e2] bg-[#fbfcfb] px-3 text-sm text-[#31584b] outline-none focus:border-[#9a6b43]"><option>João Paulo</option><option>Danieli</option><option>Ambos</option></select></Field>{form.type === "despesa" && <Field label="Forma de pagamento"><select value={form.payment} onChange={(event) => { const payment = event.target.value; update("payment", payment); if (!canUseInstallments(payment)) update("installments", "1"); }} className="h-12 w-full rounded-xl border border-[#dfe9e2] bg-[#fbfcfb] px-3 text-sm text-[#31584b] outline-none focus:border-[#9a6b43]">{payments.map((item) => <option key={item}>{item}</option>)}</select></Field>}{shouldShowInstallments(form.type, form.payment) && <InstallmentField value={form.installments} disabled={!canUseInstallments(form.payment)} canUseInstallments={canUseInstallments(form.payment)} onChange={(value) => update("installments", updateInstallmentsInput(value))} />}</div><p className="text-xs text-[#8b9c94]">A data informada representa a primeira parcela. As demais serão lançadas nos meses seguintes.</p><Field label="Observação"><textarea value={form.note} onChange={(event) => update("note", event.target.value)} placeholder="Adicione um contexto, se quiser..." className="min-h-24 w-full resize-none rounded-xl border border-[#dfe9e2] bg-[#fbfcfb] px-3 py-3 text-sm text-[#31584b] outline-none placeholder:text-[#a6b1ab] focus:border-[#9a6b43]" /></Field></CardContent></Card><Button type="submit" className="h-12 w-full rounded-xl bg-[#173f35] font-semibold text-white shadow-lg shadow-[#173f35]/15 hover:bg-[#235b4c]"><Plus className="mr-2 h-4 w-4" />Salvar lançamento</Button></form></div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block"><span className="mb-2 block text-xs font-semibold text-[#71847a]">{label}</span>{children}</label>; }

export function TransactionsView({ transactions, onDelete, onDeleteGroup, onUpdate, onUpdateGroup, categoriesData, payments }: { transactions: Transaction[]; onDelete: (id: number) => void; onDeleteGroup: (groupId: string) => void; onUpdate: (transaction: Transaction) => void; onUpdateGroup: (groupId: string, total: number, note: string, payment: string) => void; categoriesData: Record<string, string[]>; payments: string[] }) {
  const [filter, setFilter] = useState("Todos");
  const [responsible, setResponsible] = useState("Todos");
  const [payment, setPayment] = useState("Todos");
  const currentRange = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const monthNumber = String(now.getMonth() + 1).padStart(2, "0");
    const lastDay = new Date(year, now.getMonth() + 1, 0).getDate();
    return { from: `${year}-${monthNumber}-01`, to: `${year}-${monthNumber}-${String(lastDay).padStart(2, "0")}` };
  }, []);
  const [fromDate, setFromDate] = useState(currentRange.from);
  const [toDate, setToDate] = useState(currentRange.to);
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editAmount, setEditAmount] = useState("");
  const [editNote, setEditNote] = useState("");
  const [editPayment, setEditPayment] = useState("");
  const filtered = filterTransactions(transactions, { from: fromDate, to: toDate, category: filter, responsible, payment }).filter((item) => `${item.category} ${item.subcategory} ${item.note}`.toLowerCase().includes(search.toLowerCase()));
  const displayItems = Array.from(new Map(filtered.map((item) => [item.installmentGroupId ?? `single-${item.id}`, item])).values());
  const beginEdit = (item: Transaction) => { setEditingId(item.id); setEditAmount(String(item.amount).replace(".", ",")); setEditNote(item.note); setEditPayment(item.payment); };
  const saveEdit = (item: Transaction, scope: "item" | "group") => { const amount = Number(editAmount.replace(",", ".")); if (!amount || amount <= 0) { toast.error("Informe um valor válido."); return; } if (scope === "group" && item.installmentGroupId) { onUpdateGroup(item.installmentGroupId, amount, editNote, editPayment); } else { onUpdate({ ...item, amount, note: editNote, payment: editPayment }); } setEditingId(null); toast.success(scope === "group" ? "Grupo parcelado atualizado." : "Parcela atualizada."); };
  return <div className="mx-auto max-w-[1100px] px-4 py-5 sm:px-6 lg:py-8"><div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="mb-2 text-[11px] font-bold uppercase tracking-[0.2em] text-[#a16d45]">Histórico</p><h1 className="font-display text-3xl font-semibold tracking-[-0.04em] text-[#173f35]">Lançamentos</h1><p className="mt-2 text-sm text-[#77877f]">{filtered.length} registros encontrados no período selecionado.</p></div><Button className="h-11 rounded-xl bg-[#173f35] text-white hover:bg-[#235b4c]"><Plus className="mr-2 h-4 w-4" />Novo lançamento</Button></div><Card className="rounded-2xl border-[#e0e9e3] bg-white shadow-[0_8px_30px_rgba(30,62,48,0.04)]"><CardContent className="p-4 sm:p-6"><div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5"><div className="relative sm:col-span-2 lg:col-span-1"><ListFilter className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9aa9a2]" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar..." className="h-11 rounded-xl border-[#dfe9e2] pl-9" /></div><label className="flex items-center gap-2 text-xs font-semibold text-[#71847a]">De:<Input aria-label="De" type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} className="h-11 rounded-xl border-[#dfe9e2] bg-white px-3 text-sm font-normal text-[#557067]" /></label><label className="flex items-center gap-2 text-xs font-semibold text-[#71847a]">Até:<Input aria-label="Até" type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} className="h-11 rounded-xl border-[#dfe9e2] bg-white px-3 text-sm font-normal text-[#557067]" /></label><select value={filter} onChange={(event) => setFilter(event.target.value)} className="h-11 rounded-xl border border-[#dfe9e2] bg-white px-3 text-sm text-[#557067]"><option>Todos</option>{Object.keys(categoriesData).map((item) => <option key={item}>{item}</option>)}</select><select value={responsible} onChange={(event) => setResponsible(event.target.value)} className="h-11 rounded-xl border border-[#dfe9e2] bg-white px-3 text-sm text-[#557067]"><option>Todos</option><option>João Paulo</option><option>Danieli</option><option>Ambos</option></select><select value={payment} onChange={(event) => setPayment(event.target.value)} className="h-11 rounded-xl border border-[#dfe9e2] bg-white px-3 text-sm text-[#557067]"><option>Todos</option>{payments.map((option) => <option key={option}>{option}</option>)}</select></div><div className="space-y-2">{displayItems.map((item) => editingId === item.id ? <div key={item.id} className="rounded-xl border border-[#cbdad1] bg-[#f7faf8] p-3"><div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end"><Field label="Valor"><Input value={editAmount} onChange={(event) => setEditAmount(event.target.value)} inputMode="decimal" className="h-10 rounded-lg border-[#dfe9e2] bg-white" /></Field><Field label="Forma de pagamento"><select value={editPayment} onChange={(event) => setEditPayment(event.target.value)} className="h-10 rounded-lg border border-[#dfe9e2] bg-white px-3 text-sm text-[#31584b]">{payments.map((option) => <option key={option}>{option}</option>)}</select></Field><Field label="Observação"><Input value={editNote} onChange={(event) => setEditNote(event.target.value)} className="h-10 rounded-lg border-[#dfe9e2] bg-white" /></Field><div className="flex flex-wrap gap-2"><Button onClick={() => saveEdit(item, "item")} className="h-10 rounded-lg bg-[#173f35] text-white">Salvar parcela</Button>{item.installmentGroupId && <Button onClick={() => saveEdit(item, "group")} variant="outline" className="h-10 rounded-lg border-[#dfe9e2] text-[#98633c]">Salvar total do grupo</Button>}<Button onClick={() => setEditingId(null)} variant="outline" className="h-10 rounded-lg border-[#dfe9e2]">Cancelar</Button></div></div></div> : <div key={item.id} className="group flex items-center gap-3 rounded-xl border border-transparent p-3 transition-colors hover:border-[#e0e9e3] hover:bg-[#fbfcfb]"><div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${item.type === "receita" ? "bg-[#e6f1eb] text-[#297059]" : "bg-[#f8e8e5] text-[#a55348]"}`}>{item.type === "receita" ? <ArrowUpRight className="h-5 w-5" /> : <ArrowDownRight className="h-5 w-5" />}</div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="truncate text-sm font-semibold text-[#31584b]">{item.subcategory}</p><span className="rounded-md bg-[#f1f5f2] px-2 py-0.5 text-[10px] font-semibold text-[#7c8d85]">{item.category}</span>{item.installmentGroupId && <span className="rounded-md bg-[#f5ecdf] px-2 py-0.5 text-[10px] font-semibold text-[#98633c]">Parcelado · {item.installmentCount}x</span>}</div><p className="mt-1 truncate text-xs text-[#95a39c]">{dateLabel(item.date)} · {item.responsible} · {item.payment}</p></div><p className={`hidden text-sm font-bold sm:block ${item.type === "receita" ? "text-[#297059]" : "text-[#a55348]"}`}>{item.type === "receita" ? "+" : "−"}{currency(item.amount)}</p><div className="flex items-center gap-1"><button onClick={() => beginEdit(item)} className="rounded-lg p-2 text-[#83938b] hover:bg-[#eef4f0] hover:text-[#173f35]" aria-label="Editar"><Pencil className="h-4 w-4" /></button>{item.installmentGroupId ? <><button onClick={() => onDelete(item.id)} className="rounded-lg p-2 text-[#83938b] hover:bg-[#f8e8e5] hover:text-[#a55348]" aria-label="Excluir esta parcela" title="Excluir esta parcela"><Trash2 className="h-4 w-4" /></button><button onClick={() => onDeleteGroup(item.installmentGroupId!)} className="rounded-lg p-2 text-[#a55348] hover:bg-[#f8e8e5]" aria-label="Excluir todas as parcelas" title="Excluir todas as parcelas"><Trash2 className="h-4 w-4" /></button></> : <button onClick={() => onDelete(item.id)} className="rounded-lg p-2 text-[#83938b] hover:bg-[#f8e8e5] hover:text-[#a55348]" aria-label="Excluir" title="Excluir"><Trash2 className="h-4 w-4" /></button>}</div></div>)}{filtered.length === 0 && <div className="py-12 text-center"><ReceiptText className="mx-auto h-8 w-8 text-[#b6c2bc]" /><p className="mt-3 text-sm font-semibold text-[#5a7166]">Nenhum lançamento encontrado</p><p className="mt-1 text-xs text-[#9aa9a2]">Tente mudar os filtros ou a busca.</p></div>}</div></CardContent></Card></div>;
}

function SettingsView({ categoriesData, onAddCategory, onAddSubcategory, onRenameCategory, onRenameSubcategory, onRemoveCategory, onRemoveSubcategory, onReorderCategory, onReorderSubcategory, payments, onAddPayment, onRemovePayment }: { categoriesData: Record<string, string[]>; onAddCategory: (name: string) => void; onAddSubcategory: (category: string, name: string) => void; onRenameCategory: (oldName: string, newName: string) => void; onRenameSubcategory: (category: string, oldName: string, newName: string) => void; onRemoveCategory: (name: string) => void; onRemoveSubcategory: (category: string, name: string) => void; onReorderCategory: (from: string, to: string) => void; onReorderSubcategory: (category: string, from: string, to: string) => void; payments: string[]; onAddPayment: (name: string) => void; onRemovePayment: (name: string) => void }) {
  return <div className="mx-auto max-w-[1000px] px-4 py-5 sm:px-6 lg:py-8"><div className="mb-7"><p className="mb-2 text-[11px] font-bold uppercase tracking-[0.2em] text-[#a16d45]">Personalização</p><h1 className="font-display text-3xl font-semibold tracking-[-0.04em] text-[#173f35]">Configurações</h1><p className="mt-2 text-sm text-[#77877f]">Deixe o Fluxo com a cara da rotina financeira de vocês.</p></div><div className="grid gap-5 lg:grid-cols-2"><CategoryManager categories={categoriesData} onAddCategory={onAddCategory} onAddSubcategory={onAddSubcategory} onRenameCategory={onRenameCategory} onRenameSubcategory={onRenameSubcategory} onRemoveCategory={onRemoveCategory} onRemoveSubcategory={onRemoveSubcategory} onReorderCategory={onReorderCategory} onReorderSubcategory={onReorderSubcategory} /><Card className="rounded-2xl border-[#e0e9e3] bg-white shadow-[0_8px_30px_rgba(30,62,48,0.04)]"><CardHeader className="p-5 pb-3"><CardTitle className="flex items-center gap-2 font-display text-lg text-[#173f35]"><Wallet className="h-5 w-5 text-[#a16d45]" />Contas e formas de pagamento</CardTitle></CardHeader><CardContent className="space-y-3 p-5 pt-2">{payments.map((payment) => <PaymentRow key={payment} label={payment} detail={payment.includes("Conta") ? "Conta ou carteira" : "Cartão ou recorrência"} onRemove={() => onRemovePayment(payment)} />)}<div className="flex gap-2 pt-2"><Input id="new-payment" placeholder="Nova conta ou cartão..." className="h-10 rounded-xl border-[#dfe9e2]" onChange={(event) => { (window as unknown as { fluxoPaymentDraft?: string }).fluxoPaymentDraft = event.target.value; }} /><Button onClick={() => { const input = document.getElementById("new-payment") as HTMLInputElement | null; const value = input?.value.trim() ?? ""; if (!value) return; onAddPayment(value); if (input) input.value = ""; toast.success("Forma de pagamento adicionada."); }} variant="outline" className="h-10 rounded-xl border-[#dfe9e2]"><Plus className="h-4 w-4" /></Button></div></CardContent></Card></div></div>;
}

function PaymentRow({ label, detail, onRemove }: { label: string; detail: string; onRemove: () => void }) { return <div className="flex items-center gap-3 rounded-xl border border-[#edf1ee] p-3"><div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#eef5f0] text-[#477763]"><Wallet className="h-4 w-4" /></div><div className="flex-1"><p className="text-sm font-semibold text-[#31584b]">{label}</p><p className="text-xs text-[#9aa9a2]">{detail}</p></div><button type="button" onClick={onRemove} className="rounded-md p-1 text-[#b2beb7] hover:bg-[#f8e8e5] hover:text-[#a55348]" aria-label={`Remover ${label}`}><X className="h-4 w-4" /></button></div>; }

function MobileNav({ location, setLocation }: { location: string; setLocation: (path: string) => void }) { const items = [{ path: "/", label: "Visão geral", icon: BarChart3 }, { path: "/lancamentos", label: "Lançamentos", icon: ReceiptText }, { path: "/novo", label: "Novo", icon: Plus }, { path: "/configuracoes", label: "Ajustes", icon: Settings2 }]; return <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-[#dfe9e2] bg-white/95 px-2 pb-[max(0.55rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-8px_30px_rgba(30,62,48,0.07)] backdrop-blur md:hidden"><div className="mx-auto flex max-w-md items-center justify-around">{items.map((item) => { const active = location === item.path; return <button key={item.path} onClick={() => setLocation(item.path)} className={`relative flex min-w-[62px] flex-col items-center gap-1 rounded-xl px-2 py-1.5 text-[10px] font-semibold transition-colors ${active ? "text-[#173f35]" : "text-[#9aa9a2]"}`}>{active && <span className="absolute -top-2 h-1 w-5 rounded-full bg-[#a16d45]" />}<item.icon className={`h-[18px] w-[18px] ${active ? "text-[#a16d45]" : ""}`} /><span>{item.label}</span></button>; })}</div></nav>; }

export default function Home() {
  const [location, setLocation] = useLocation();
  const [localTransactions, setTransactions] = usePersistentState<Transaction[]>("fluxo:transactions", seedTransactions);
  const remoteTransactionsQuery = trpc.transactions.list.useQuery(undefined, { retry: false });
  const transactions = resolveTransactions(remoteTransactionsQuery.data, localTransactions);
  const [dashboardMonth, setDashboardMonth] = useState<string | undefined>(undefined);
  const [categoriesData, setCategoriesData] = usePersistentState<Record<string, string[]>>("fluxo:categories", { ...categories });
  const [payments, setPayments] = usePersistentState<string[]>("fluxo:payments", ["Conta conjunta", "Cartão principal", "Conta investimentos", "Débito automático"]);
  const createTransactions = trpc.transactions.create.useMutation();
  const deleteTransactionMutation = trpc.transactions.delete.useMutation();
  const deleteTransactionsMutation = trpc.transactions.deleteMany.useMutation();
  const addTransactions = async (newTransactions: Transaction[]) => {
    await createTransactions.mutateAsync({
      transactions: newTransactions.map((transaction) => ({
        date: transaction.date,
        type: transaction.type,
        amount: transaction.amount,
        category: transaction.category,
        subcategory: transaction.subcategory,
        responsible: transaction.responsible,
        payment: transaction.type === "receita" ? null : transaction.payment,
        note: transaction.note || null,
        installmentGroupId: transaction.installmentGroupId ?? null,
        installmentNumber: transaction.installmentNumber,
        installmentCount: transaction.installmentCount,
      })),
    });
    setTransactions((current) => [...newTransactions, ...current]);
  };
  const addCategory = (name: string) => setCategoriesData((current) => current[name] ? current : { ...current, [name]: ["Geral"] });
  const addSubcategory = (category: string, subcategory: string) => setCategoriesData((current) => ({ ...current, [category]: current[category]?.includes(subcategory) ? current[category] : [...(current[category] ?? []), subcategory] }));
  const renameCategory = (oldName: string, newName: string) => { const next = renameNamedEntry(categoriesData, oldName, newName); if (Object.keys(next).join("|") === Object.keys(categoriesData).join("|")) { toast.error("Nome vazio, igual ou já utilizado."); return; } setCategoriesData(next); const value = Object.keys(next).find((item) => !Object.prototype.hasOwnProperty.call(categoriesData, item)) ?? oldName; setTransactions((current) => current.map((item) => item.category === oldName ? { ...item, category: value } : item)); toast.success("Categoria atualizada."); };
  const renameSubcategory = (category: string, oldName: string, newName: string) => { const nextSubs = renameListItem(categoriesData[category] ?? [], oldName, newName); if (nextSubs.join("|") === (categoriesData[category] ?? []).join("|")) { toast.error("Nome vazio, igual ou já utilizado."); return; } setCategoriesData((current) => ({ ...current, [category]: nextSubs })); const value = nextSubs.find((item) => !(categoriesData[category] ?? []).includes(item)) ?? oldName; setTransactions((current) => current.map((item) => item.category === category && item.subcategory === oldName ? { ...item, subcategory: value } : item)); toast.success("Subcategoria atualizada."); };
  const removeCategory = (name: string) => { if (!canDeleteCategory(transactions, name)) { toast.error("Não é possível excluir: existem lançamentos usando esta categoria."); return; } if (!window.confirm(`Excluir a categoria ${name}?`)) return; setCategoriesData((current) => { const next = { ...current }; delete next[name]; return next; }); toast.success("Categoria excluída."); };
  const removeSubcategory = (category: string, subcategory: string) => { if (!canDeleteSubcategory(transactions, category, subcategory)) { toast.error("Não é possível excluir: existem lançamentos usando esta subcategoria."); return; } if (!window.confirm(`Excluir a subcategoria ${subcategory}?`)) return; setCategoriesData((current) => ({ ...current, [category]: (current[category] ?? []).filter((item) => item !== subcategory) })); toast.success("Subcategoria excluída."); };
  const reorderCategory = (from: string, to: string) => setCategoriesData((current) => reorderNamedEntries(current, from, to));
  const reorderSubcategory = (category: string, from: string, to: string) => setCategoriesData((current) => ({ ...current, [category]: reorderListItem(current[category] ?? [], (current[category] ?? []).indexOf(from), (current[category] ?? []).indexOf(to)) }));
  const addPayment = (name: string) => setPayments((current) => current.includes(name) ? current : [...current, name]);
  const removePayment = (name: string) => setPayments((current) => current.filter((item) => item !== name));
  const updateTransaction = (transaction: Transaction) => setTransactions((current) => current.map((item) => item.id === transaction.id ? transaction : item));
  const updateTransactionGroup = (groupId: string, total: number, note: string, payment: string) => setTransactions((current) => { const group = current.filter((item) => item.installmentGroupId === groupId).sort((a, b) => (a.installmentNumber ?? 0) - (b.installmentNumber ?? 0)); const values = splitInstallments(total, group.length); return current.map((item) => { const index = group.findIndex((entry) => entry.id === item.id); return index >= 0 ? { ...item, amount: values[index], note: note ? `Parcela ${index + 1}/${group.length} · ${note}` : `Parcela ${index + 1}/${group.length}`, payment } : item; }); });
  const deleteTransaction = (id: number) => deleteTransactionRemotely(id, deleteTransactionMutation, () => setTransactions((current) => current.filter((item) => item.id !== id)), remoteTransactionsQuery.refetch);
  const deleteTransactionGroup = (groupId: string) => {
    const ids = transactions.filter((item) => item.installmentGroupId === groupId).map((item) => item.id).filter((id) => id > 0);
    return deleteTransactionsRemotely(ids, deleteTransactionsMutation, () => setTransactions((current) => current.filter((item) => item.installmentGroupId !== groupId)), remoteTransactionsQuery.refetch);
  };
  const view = useMemo(() => location === "/lancamentos" ? "transactions" : location === "/novo" ? "new" : location === "/configuracoes" ? "settings" : "dashboard", [location]);
  return <><div className="min-h-screen">{view === "dashboard" && <DashboardView transactions={transactions} selectedMonth={dashboardMonth} onMonthChange={setDashboardMonth} />}{view === "transactions" && <TransactionsView transactions={transactions} onDelete={deleteTransaction} onDeleteGroup={deleteTransactionGroup} onUpdate={updateTransaction} onUpdateGroup={updateTransactionGroup} categoriesData={categoriesData} payments={payments} />}{view === "new" && <NewTransaction onAdd={addTransactions} categoriesData={categoriesData} payments={payments} />}{view === "settings" && <SettingsView categoriesData={categoriesData} onAddCategory={addCategory} onAddSubcategory={addSubcategory} onRenameCategory={renameCategory} onRenameSubcategory={renameSubcategory} onRemoveCategory={removeCategory} onRemoveSubcategory={removeSubcategory} onReorderCategory={reorderCategory} onReorderSubcategory={reorderSubcategory} payments={payments} onAddPayment={addPayment} onRemovePayment={removePayment} />}</div><MobileNav location={location} setLocation={setLocation} /></>;
}
