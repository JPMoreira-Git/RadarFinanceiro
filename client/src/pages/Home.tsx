import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import React, { useMemo, useState, useEffect } from "react";
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
  id: string;
  date: string;
  type: TransactionType;
  amount: number;
  category: string;
  subcategory: string;
  subcategoria_id?: string | null;
  responsible: string;
  payment: string;
  note: string;
  installmentGroupId?: string | null;
  installmentNumber?: number | null;
  installmentCount?: number | null;
};

type RemoteTransactionRow = {
  id: string;
  descricao: string | null;
  valor: number;
  data: string;
  tipo: string;
  forma_pagamento: string | null;
  parcelas: number | null;
  parcela_atual: number | null;
  grupo_parcela_id: string | null;
  responsavel: string;
  subcategoria_id: string | null;
  categorias?: { nome: string } | null;
  subcategorias?: { nome: string } | null;
};

export function normalizeRemoteTransactionType(value: unknown): TransactionType {
  const normalized = String(value ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return normalized === "receita" || normalized === "income" || normalized === "entrada" ? "receita" : "despesa";
}

export function mapSupabaseTransaction(row: RemoteTransactionRow): Transaction {
  return {
    id: row.id,
    date: String(row.data).slice(0, 10),
    type: normalizeRemoteTransactionType(row.tipo),
    amount: Number(row.valor),
    category: row.categorias?.nome ?? "Outros",
    subcategory: row.subcategorias?.nome ?? "Geral",
    subcategoria_id: row.subcategoria_id,
    responsible: row.responsavel,
    payment: row.forma_pagamento ?? "",
    note: row.descricao ?? "",
    installmentGroupId: row.grupo_parcela_id,
    installmentNumber: row.parcela_atual,
    installmentCount: row.parcelas,
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

export async function deleteTransactionRemotely(id: string, mutation: { mutateAsync: (input: { id: string }) => Promise<unknown> }, onSuccess: () => void, refetch: () => Promise<unknown>) {
  try {
    await mutation.mutateAsync({ id });
    await refetch();
    onSuccess();
    toast.success("Lançamento removido.");
  } catch (error) {
    handleDeleteError(error);
  }
}

export async function deleteTransactionsRemotely(ids: string[], mutation: { mutateAsync: (input: { ids: string[] }) => Promise<unknown> }, onSuccess: () => void, refetch: () => Promise<unknown>) {
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
  return <div className="w-full" aria-label="Ritmo financeiro mensal"><svg viewBox={`0 0 ${width} ${height}`} className="h-[290px] w-full" role="img" aria-label="Receita Total, Investimentos e Despesas por mês"><line x1={plotLeft} x2={plotRight} y1={plotBottom} y2={plotBottom} stroke="#dfe9e2" /><line x1={plotLeft} x2={plotRight} y1={plotTop} y2={plotTop} stroke="#edf1ee" /><line x1={plotLeft} x2={plotRight} y1={(plotTop + plotBottom) / 2} y2={(plotTop + plotBottom) / 2} stroke="#edf1ee" /><text x="8" y={plotTop + 4} fill="#91a098" fontSize="10">{compactCurrency(maxBar)}</text><text x="12" y={(plotTop + plotBottom) / 2 + 4} fill="#91a098" fontSize="10">{compactCurrency(maxBar / 2)}</text>{data.map((item, index) => <g key={item.month}><rect x={x(index) - 16} y={yBar(item.receita)} width="32" height={Math.max(0, plotBottom - yBar(item.receita))} rx="7" fill="#cfe5d9" /><text x={x(index)} y={item.receita === 0 ? plotBottom - 8 : yBar(item.receita) - 8} textAnchor="middle" fill="#297059" fontSize="10" fontWeight="700">{chartLabel(item.receita)}</text><text x={x(index)} y="252" textAnchor="middle" fill="#91a098" fontSize="11">{item.month}</text></g>)}<path d={areaPath("investimentos")} fill="#8fc4a5" fillOpacity="0.2" /><path d={areaPath("gastos")} fill="#e5a59a" fillOpacity="0.16" /><path d={linePath("investimentos")} fill="none" stroke="#3f8b63" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /><path d={linePath("gastos")} fill="none" stroke="#c4685a" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />{data.map((item, index) => { const investmentY = yLine(item.investimentos); const expenseY = yLine(item.gastos); const offsets = lineLabelOffsets(investmentY, expenseY); return <g key={`points-${item.month}`}><circle cx={x(index)} cy={investmentY} r="4" fill="#3f8b63" /><circle cx={x(index)} cy={expenseY} r="4" fill="#c4685a" />{item.investimentos > 0 && <text x={x(index)} y={investmentY + offsets.investments} textAnchor="middle" fill="#3f8b63" fontSize="10" fontWeight="700">{chartLabel(item.investimentos)}</text>}</g>; })}</svg></div>;
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
  const chartTransactions = transactions.map((item) => ({ ...item, type: item.type === "receita" ? "receita" as const : "despesa" as const, amount: Number(item.amount) }));
  const monthlyData = buildDashboardChartData(chartTransactions, selectedMonth);
  const investmentExpenseWaterfall = buildInvestmentExpenseWaterfall(transactions);
  const incomeExpenseWaterfall = buildIncomeExpenseWaterfall(transactions);
  const recent = monthTransactions.slice(0, 4);

  return <div className="mx-auto max-w-[1400px] px-4 py-5 sm:px-6 lg:px-8 lg:py-8"><div className="mb-7 flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><p className="mb-2 text-[11px] font-bold uppercase tracking-[0.2em] text-[#a16d45]">{monthLabel(selectedMonth)} {selectedMonth.slice(0, 4)}</p><h1 className="font-display text-3xl font-semibold tracking-[-0.04em] text-[#173f35] sm:text-4xl">Visão geral do mês</h1><p className="mt-2 max-w-xl text-sm leading-6 text-[#77877f]">Acompanhe o fluxo da família e veja se os rendimentos já cobrem o custo de viver bem.</p></div><div className="flex items-center gap-2"><Button variant="outline" onClick={() => onMonthChange?.(previousMonth)} aria-label={`Selecionar ${monthLabel(previousMonth)}`} className="h-10 rounded-xl border-[#d7e1db] bg-white text-[#557067] hover:bg-[#f0f5f2]"><ChevronLeft className="mr-1 h-4 w-4" />{monthLabel(previousMonth)}</Button><span className="hidden h-10 items-center rounded-xl bg-[#edf5ef] px-3 text-sm font-semibold capitalize text-[#31584b] sm:flex">{monthLabel(selectedMonth)}</span><Button variant="outline" onClick={() => onMonthChange?.(shiftMonth(selectedMonth, 1))} aria-label={`Selecionar ${monthLabel(shiftMonth(selectedMonth, 1))}`} className="h-10 rounded-xl border-[#d7e1db] bg-white text-[#557067] hover:bg-[#f0f5f2]">{monthLabel(shiftMonth(selectedMonth, 1))}<ChevronRight className="ml-1 h-4 w-4" /></Button></div></div><div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4"><StatCard label="Receitas" value={currency(receita)} detail={revenueChange === null ? "Sem base para comparação" : `${revenueChange >= 0 ? "+" : "−"}${Math.abs(revenueChange).toFixed(1).replace(".", ",")}% em relação a ${monthLabel(previousMonth)}`} detailClassName={revenueChange === null ? undefined : revenueChange < 0 ? "text-[#a55348]" : "text-[#297059]"} tone="green" icon={ArrowUpRight} /><StatCard label="Despesas" value={currency(despesas)} detail={expensesChange === null ? "Sem base para comparação" : `${expensesChange >= 0 ? "+" : "−"}${Math.abs(expensesChange).toFixed(1).replace(".", ",")}% em relação a ${monthLabel(previousMonth)}`} detailClassName={expensesChange === null ? undefined : expensesChange < 0 ? "text-[#297059]" : expensesChange > 0 ? "text-[#a55348]" : "text-[#81918a]"} tone="rose" icon={ArrowDownRight} /><StatCard label="Saldo do mês" value={currency(receita - despesas)} detail="Disponível após as saídas" tone="sand" icon={CircleDollarSign} /><StatCard label="Cobertura" value={`${coverage.toFixed(0)}%`} detail="Rendimentos vs. despesas" tone="blue" icon={TrendingUp} /></div><div className="mt-6 grid gap-5 xl:grid-cols-[1.45fr_0.55fr]"><Card className="rounded-2xl border-[#e0e9e3] bg-white shadow-[0_8px_30px_rgba(30,62,48,0.04)]"><CardHeader className="border-b border-[#edf1ee] p-5 pb-4 sm:p-6 sm:pb-4"><div className="flex items-center justify-between gap-3"><CardTitle className="font-display text-xl text-[#173f35]">Ritmo financeiro</CardTitle><div className="flex items-center gap-2 rounded-xl bg-[#f5f8f5] px-3 py-2 text-xs text-[#71847a]"><span className="h-2 w-2 rounded-full bg-[#a16d45]" /> Atualizado agora</div></div></CardHeader><CardContent className="p-3 pt-5 sm:p-6"><FinancialRhythmChart data={monthlyData} /></CardContent></Card><div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-1"><Card className="rounded-2xl border-[#e0e9e3] bg-[#173f35] text-white shadow-[0_12px_35px_rgba(23,63,53,0.13)]"><CardContent className="p-5 sm:p-6"><div className="flex items-start justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#b9d4c6]">Rendimento</p><p className="mt-2 font-display text-3xl font-semibold">{currency(investimentos)}</p></div><div className="rounded-xl bg-white/10 p-2.5"><Sparkles className="h-5 w-5 text-[#e7c7a7]" /></div></div><div className="mt-6"><div className="mb-2 flex justify-between text-xs text-[#c2d6cb]"><span>Cobertura das despesas</span><span>{coverage.toFixed(0)}%</span></div><div className="h-2 overflow-hidden rounded-full bg-white/15"><div className="h-full rounded-full bg-[#d6a77b]" style={{ width: `${Math.min(coverage, 100)}%` }} /></div></div><p className="mt-4 text-xs leading-5 text-[#b9d4c6]">Faltam {currency(Math.max(despesas - investimentos, 0))} para os investimentos cobrirem todas as saídas.</p></CardContent></Card><Card className="rounded-2xl border-[#e0e9e3] bg-white shadow-[0_8px_30px_rgba(30,62,48,0.04)]"><CardContent className="p-5"><div className="mb-4 flex items-center justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#a16d45]">Atividade</p><h3 className="mt-1 font-display text-lg font-semibold text-[#173f35]">Últimos lançamentos</h3></div><ReceiptText className="h-5 w-5 text-[#9a6b43]" /></div><div className="space-y-3">{recent.length > 0 ? recent.map((item) => <div key={item.id} className="flex items-center gap-3"><div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${item.type === "receita" ? "bg-[#e6f1eb] text-[#297059]" : "bg-[#f8e8e5] text-[#a55348]"}`}>{item.type === "receita" ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}</div><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-[#31584b]">{item.category} · {item.subcategory}</p><p className="text-[11px] text-[#96a49d]">{dateLabel(item.date)} · {item.responsible}{item.installmentCount && item.installmentCount > 1 ? ` · Parcela ${item.installmentNumber}/${item.installmentCount}` : ""}</p></div><p className={`text-sm font-semibold ${item.type === "receita" ? "text-[#297059]" : "text-[#a55348]"}`}>{item.type === "receita" ? "+" : "−"}{currency(item.amount)}</p></div>) : <p className="rounded-xl bg-[#f5f8f5] p-3 text-xs leading-5 text-[#81918a]">Nenhum lançamento em {monthLabel(selectedMonth)}.</p>}</div></CardContent></Card></div></div><div className="mt-6 grid gap-5 xl:grid-cols-2"><DivergingBalanceCard title="Investimentos x Despesas" values={investmentExpenseWaterfall.filter((item) => !("isTotal" in item && item.isTotal)).map((item) => ({ label: item.label, value: item.value }))} /><DivergingBalanceCard title="Renda Total x Despesas" values={incomeExpenseWaterfall.filter((item) => !("isTotal" in item && item.isTotal)).map((item) => ({ label: item.label, value: item.value }))} /></div></div>;
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

export function NewTransaction({ onAdd, categoriesData, subcategoriesData, payments }: { onAdd: (transactions: Transaction[]) => void | Promise<unknown>; categoriesData: any[]; subcategoriesData: any[]; payments: string[] }) {
  const [form, setForm] = useState({ date: todayInputValue(), type: "despesa" as TransactionType, amount: "", category: "", subcategory: "", subcategoria_id: "", responsible: "Ambos", payment: "Conta conjunta", note: "", installments: "1" });

  const filteredCategories = useMemo(() => {
    return categoriesData.filter(c => c.tipo === form.type);
  }, [categoriesData, form.type]);

  const filteredSubcategories = useMemo(() => {
    if (!form.category) return [];
    const cat = categoriesData.find(c => c.nome === form.category);
    return subcategoriesData.filter(s => s.categoria_id === cat?.id);
  }, [subcategoriesData, form.category, categoriesData]);

  useEffect(() => {
    if (filteredCategories.length > 0 && !form.category) {
      update("category", filteredCategories[0].nome);
    }
  }, [filteredCategories]);

  const update = (key: string, value: string) => setForm((current) => {
    if (key === "type") {
      const nextCats = categoriesData.filter(c => c.tipo === value);
      const nextCat = nextCats[0]?.nome ?? "";
      const nextCatId = nextCats[0]?.id;
      const nextSubs = subcategoriesData.filter(s => s.categoria_id === nextCatId);
      return { ...current, type: value as TransactionType, category: nextCat, subcategory: nextSubs[0]?.nome ?? "", subcategoria_id: nextSubs[0]?.id ?? "" };
    }
    if (key === "category") {
      const cat = categoriesData.find(c => c.nome === value);
      const nextSubs = subcategoriesData.filter(s => s.categoria_id === cat?.id);
      return { ...current, category: value, subcategory: nextSubs[0]?.nome ?? "", subcategoria_id: nextSubs[0]?.id ?? "" };
    }
    if (key === "subcategory") {
      const sub = subcategoriesData.find(s => s.nome === value && s.categoria_id === categoriesData.find(c => c.nome === current.category)?.id);
      return { ...current, subcategory: value, subcategoria_id: sub?.id ?? "" };
    }
    return { ...current, [key]: value };
  });

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const amount = Number(form.amount.replace(",", "."));
    const installments = normalizeInstallments(form.installments);
    if (!amount || amount <= 0) { toast.error("Informe um valor válido para o lançamento."); return; }
    const created = buildInstallmentTransactions({ idSeed: Date.now(), date: form.date, type: form.type, amount, category: form.category, subcategory: form.subcategory, subcategoria_id: form.subcategoria_id, responsible: form.responsible, payment: form.payment, note: form.note, installments });
    try {
      await onAdd(created);
      toast.success(installments > 1 ? `Compra dividida em ${installments} parcelas.` : "Lançamento adicionado ao resumo.");
      setForm((current) => ({ ...current, amount: "", note: "", installments: "1" }));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível salvar o lançamento.");
    }
  };

  return <div className="mx-auto max-w-3xl px-4 py-5 sm:px-6 lg:py-8"><div className="mb-7"><p className="mb-2 text-[11px] font-bold uppercase tracking-[0.2em] text-[#a16d45]">Novo registro</p><h1 className="font-display text-3xl font-semibold tracking-[-0.04em] text-[#173f35]">O que aconteceu hoje?</h1><p className="mt-2 text-sm text-[#77877f]">Registre uma entrada ou saída para manter o fluxo da família atualizado.</p></div><form onSubmit={submit} className="space-y-5"><Card className="rounded-2xl border-[#e0e9e3] bg-white shadow-[0_8px_30px_rgba(30,62,48,0.04)]"><CardContent className="space-y-5 p-5 sm:p-7"><div><p className="mb-3 text-xs font-bold uppercase tracking-[0.14em] text-[#71847a]">Tipo de lançamento</p><div className="grid grid-cols-2 gap-3"><button type="button" onClick={() => update("type", "despesa")} className={`rounded-xl border p-4 text-left transition-all ${form.type === "despesa" ? "border-[#c4685a] bg-[#fcf0ee] text-[#a55348]" : "border-[#e0e9e3] bg-white text-[#82918a]"}`}><ArrowDownRight className="mb-3 h-5 w-5" /><p className="text-sm font-semibold">Despesa</p><p className="mt-1 text-xs opacity-70">Algo que saiu</p></button><button type="button" onClick={() => update("type", "receita")} className={`rounded-xl border p-4 text-left transition-all ${form.type === "receita" ? "border-[#3f8b63] bg-[#edf5ef] text-[#297059]" : "border-[#e0e9e3] bg-white text-[#82918a]"}`}><ArrowUpRight className="mb-3 h-5 w-5" /><p className="text-sm font-semibold">Receita</p><p className="mt-1 text-xs opacity-70">Algo que entrou</p></button></div></div><div className="grid gap-5 sm:grid-cols-2"><div><label className="mb-2 block text-xs font-bold uppercase tracking-[0.14em] text-[#71847a]">Data</label><Input type="date" value={form.date} onChange={(e) => update("date", e.target.value)} className="h-12 rounded-xl border-[#dfe9e2] bg-[#fbfcfb]" /></div><div><label className="mb-2 block text-xs font-bold uppercase tracking-[0.14em] text-[#71847a]">Valor</label><div className="relative"><span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold text-[#31584b]">R$</span><Input type="text" inputMode="decimal" placeholder="0,00" value={form.amount} onChange={(e) => update("amount", e.target.value)} className="h-12 rounded-xl border-[#dfe9e2] bg-[#fbfcfb] pl-10 font-display text-lg font-semibold" /></div></div></div><div className="grid gap-5 sm:grid-cols-2"><div><label className="mb-2 block text-xs font-bold uppercase tracking-[0.14em] text-[#71847a]">Categoria</label><select value={form.category} onChange={(e) => update("category", e.target.value)} className="h-12 w-full rounded-xl border border-[#dfe9e2] bg-[#fbfcfb] px-4 text-sm text-[#31584b] focus:border-[#3f8b63] focus:ring-0">{filteredCategories.map((c) => <option key={c.id} value={c.nome}>{c.nome}</option>)}</select></div><div><label className="mb-2 block text-xs font-bold uppercase tracking-[0.14em] text-[#71847a]">Subcategoria</label><select value={form.subcategory} onChange={(e) => update("subcategory", e.target.value)} disabled={!form.category} className="h-12 w-full rounded-xl border border-[#dfe9e2] bg-[#fbfcfb] px-4 text-sm text-[#31584b] focus:border-[#3f8b63] focus:ring-0 disabled:opacity-50">{filteredSubcategories.map((s) => <option key={s.id} value={s.nome}>{s.nome}</option>)}</select></div></div><div className="grid gap-5 sm:grid-cols-2"><div><label className="mb-2 block text-xs font-bold uppercase tracking-[0.14em] text-[#71847a]">Responsável</label><select value={form.responsible} onChange={(e) => update("responsible", e.target.value)} className="h-12 w-full rounded-xl border border-[#dfe9e2] bg-[#fbfcfb] px-4 text-sm text-[#31584b] focus:border-[#3f8b63] focus:ring-0"><option>Ambos</option><option>João Paulo</option><option>Danieli</option></select></div><div><label className="mb-2 block text-xs font-bold uppercase tracking-[0.14em] text-[#71847a]">Forma de pagamento</label><select value={form.payment} onChange={(e) => update("payment", e.target.value)} className="h-12 w-full rounded-xl border border-[#dfe9e2] bg-[#fbfcfb] px-4 text-sm text-[#31584b] focus:border-[#3f8b63] focus:ring-0">{payments.map((p) => <option key={p}>{p}</option>)}</select></div></div>{shouldShowInstallments(form.type, form.payment) && <InstallmentField value={form.installments} onChange={(value) => update("installments", value)} />}<div><label className="mb-2 block text-xs font-bold uppercase tracking-[0.14em] text-[#71847a]">Detalhes da compra</label><Input placeholder="Opcional..." value={form.note} onChange={(e) => update("note", e.target.value)} className="h-12 rounded-xl border-[#dfe9e2] bg-[#fbfcfb]" /></div></CardContent></Card><Button type="submit" className="h-14 w-full rounded-2xl bg-[#173f35] text-lg font-semibold text-white shadow-lg hover:bg-[#205245]">Salvar lançamento</Button></form></div>;
}

export default function Home() {
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [view, setView] = usePersistentState<"dashboard" | "list" | "new" | "categories">("home-view", "dashboard");
  const { data: remoteTransactions, refetch } = trpc.transactions.list.useQuery();
  const { data: categoriesData } = trpc.categories.list.useQuery();
  const { data: subcategoriesData, refetch: refetchSubs } = trpc.categories.listSubcategories.useQuery();
  
  const createMutation = trpc.transactions.create.useMutation();
  const deleteMutation = trpc.transactions.delete.useMutation();
  const deleteManyMutation = trpc.transactions.deleteMany.useMutation();
  const createSubMutation = trpc.categories.createSubcategory.useMutation();
  const deleteSubMutation = trpc.categories.deleteSubcategory.useMutation();

  const transactions = useMemo(() => resolveTransactions(remoteTransactions, []), [remoteTransactions]);
  const monthTransactions = transactions.filter((item) => item.date.startsWith(selectedMonth));

  const structuredCategories = useMemo(() => {
    if (!categoriesData || !subcategoriesData) return {};
    const result: Record<string, string[]> = {};
    categoriesData.forEach(c => {
      result[c.nome] = subcategoriesData.filter(s => s.categoria_id === c.id).map(s => s.nome);
    });
    return result;
  }, [categoriesData, subcategoriesData]);

  const payments = ["Conta conjunta", "Conta investimentos", "Cartão principal", "Cartão secundário", "Dinheiro", "Pix", "Débito automático"];

  const handleAdd = async (newTransactions: Transaction[]) => {
    await createMutation.mutateAsync({ transactions: newTransactions });
    await refetch();
    setView("dashboard");
  };

  const handleDelete = async (transaction: Transaction) => {
    if (transaction.installmentGroupId) {
      const group = transactions.filter(t => t.installmentGroupId === transaction.installmentGroupId);
      if (window.confirm(`Deseja excluir todas as ${group.length} parcelas desta compra?`)) {
        await deleteTransactionsRemotely(group.map(t => t.id), deleteManyMutation, () => {}, refetch);
        return;
      }
    }
    if (window.confirm("Deseja excluir este lançamento?")) {
      await deleteTransactionRemotely(transaction.id, deleteMutation, () => {}, refetch);
    }
  };

  const handleAddSubcategory = async (categoryName: string, subName: string) => {
    const cat = categoriesData?.find(c => c.nome === categoryName);
    if (cat) {
      await createSubMutation.mutateAsync({ name: subName, categoryId: cat.id });
      await refetchSubs();
      toast.success("Subcategoria criada.");
    }
  };

  const handleDeleteSubcategory = async (categoryName: string, subName: string) => {
    const cat = categoriesData?.find(c => c.nome === categoryName);
    const sub = subcategoriesData?.find(s => s.nome === subName && s.categoria_id === cat?.id);
    if (sub) {
      if (window.confirm(`Deseja excluir a subcategoria ${subName}?`)) {
        await deleteSubMutation.mutateAsync({ id: sub.id });
        await refetchSubs();
        toast.success("Subcategoria excluída.");
      }
    }
  };

  return (
    <div className="min-h-screen bg-[#f7faf8]">
      <nav className="sticky top-0 z-50 border-b border-[#e0e9e3] bg-white/80 backdrop-blur-md">
        <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-8">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#173f35] text-white">
                  <BarChart3 className="h-5 w-5" />
                </div>
                <span className="font-display text-lg font-bold tracking-tight text-[#173f35]">RadarFinanceiro</span>
              </div>
              <div className="hidden md:flex md:items-center md:gap-1">
                {[
                  { id: "dashboard", label: "Dashboard", icon: BarChart3 },
                  { id: "list", label: "Lançamentos", icon: ReceiptText },
                  { id: "categories", label: "Categorias", icon: Settings2 },
                ].map((item) => (
                  <button key={item.id} onClick={() => setView(item.id as any)} className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-colors ${view === item.id ? "bg-[#edf5ef] text-[#173f35]" : "text-[#71847a] hover:bg-[#f5f8f5] hover:text-[#173f35]"}`}>
                    <item.icon className="h-4 w-4" />
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
            <Button onClick={() => setView("new")} className="h-10 rounded-xl bg-[#173f35] px-5 font-semibold text-white shadow-md hover:bg-[#205245]">
              <Plus className="mr-2 h-4 w-4" /> Novo
            </Button>
          </div>
        </div>
      </nav>

      <main>
        {view === "dashboard" && <DashboardView transactions={transactions} selectedMonth={selectedMonth} onMonthChange={setSelectedMonth} />}
        {view === "list" && (
          <div className="mx-auto max-w-[1400px] px-4 py-8 sm:px-6 lg:px-8">
            <SectionHeading title="Histórico de lançamentos" eyebrow="Registros" action={<div className="flex gap-2"><select value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="h-9 rounded-lg border-[#d7e1db] bg-white px-3 text-xs font-semibold text-[#557067]">{transactionMonthOptions(transactions).map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}</select></div>} />
            <Card className="overflow-hidden rounded-2xl border-[#e0e9e3] bg-white shadow-[0_8px_30px_rgba(30,62,48,0.04)]">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-[#edf1ee] bg-[#fbfcfb]">
                      <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-[#8b9c94]">Data</th>
                      <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-[#8b9c94]">Categoria / Sub</th>
                      <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-[#8b9c94]">Responsável</th>
                      <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-[#8b9c94]">Descrição</th>
                      <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-[#8b9c94]">Valor</th>
                      <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-[#8b9c94]"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#edf1ee]">
                    {monthTransactions.map((t) => (
                      <tr key={t.id} className="group hover:bg-[#f7faf8]">
                        <td className="whitespace-nowrap px-6 py-4 text-sm text-[#557067]">{dateLabel(t.date)}</td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                            <span className="text-sm font-semibold text-[#31584b]">{t.category}</span>
                            <span className="text-[11px] text-[#96a49d]">{t.subcategory}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-[#557067]">{t.responsible}</td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                            <span className="text-sm text-[#557067]">{t.note || "-"}</span>
                            {t.installmentCount && t.installmentCount > 1 && (
                              <span className="text-[10px] font-bold text-[#a16d45]">Parcela {t.installmentNumber}/{t.installmentCount}</span>
                            )}
                          </div>
                        </td>
                        <td className={`whitespace-nowrap px-6 py-4 text-sm font-bold ${t.type === "receita" ? "text-[#297059]" : "text-[#a55348]"}`}>
                          {t.type === "receita" ? "+" : "−"}{currency(t.amount)}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button onClick={() => handleDelete(t)} className="rounded-lg p-2 text-[#b2beb7] opacity-0 hover:bg-[#f8e8e5] hover:text-[#a55348] group-hover:opacity-100">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        )}
        {view === "new" && <NewTransaction onAdd={handleAdd} categoriesData={categoriesData || []} subcategoriesData={subcategoriesData || []} payments={payments} />}
        {view === "categories" && (
          <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
            <CategoryManager 
              categories={structuredCategories} 
              onAddCategory={() => toast.info("Criação de categorias principais deve ser feita via Banco de Dados.")}
              onAddSubcategory={handleAddSubcategory}
              onRenameCategory={() => {}}
              onRenameSubcategory={() => {}}
              onRemoveCategory={() => {}}
              onRemoveSubcategory={handleDeleteSubcategory}
              onReorderCategory={() => {}}
              onReorderSubcategory={() => {}}
            />
          </div>
        )}
      </main>
    </div>
  );
}
