import { createClient } from "@supabase/supabase-js";
import { ENV } from "./_core/env";

export function getSupabaseClient() {
  if (!ENV.supabaseUrl || !ENV.supabaseAnonKey) {
    throw new Error("Supabase não configurado: SUPABASE_URL e SUPABASE_ANON_KEY são obrigatórios.");
  }

  return createClient(ENV.supabaseUrl, ENV.supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

export type SupabaseTransactionInput = {
  date: string;
  type: "receita" | "despesa";
  amount: number;
  category: string;
  subcategory: string;
  responsible: string;
  payment: string | null;
  note: string | null;
  installmentGroupId?: string | null;
  installmentNumber?: number | null;
  installmentCount?: number | null;
  subcategoria_id?: string | null;
};

export type SupabaseTransactionInsert = {
  descricao: string | null;
  valor: number;
  data: string;
  tipo: "receita" | "despesa";
  categoria_id: string | null;
  subcategoria_id: string | null;
  forma_pagamento: string | null;
  parcelas: number;
  parcela_atual: number | null;
  grupo_parcela_id: string | null;
  responsavel: string;
};

export function toSupabaseTransactionRow(transaction: SupabaseTransactionInput): SupabaseTransactionInsert {
  return {
    descricao: transaction.note || null,
    valor: transaction.amount,
    data: transaction.date,
    tipo: transaction.type,
    categoria_id: null, // Ainda não temos o ID da categoria no input, será preenchido se necessário ou via subcategoria
    subcategoria_id: transaction.subcategoria_id || null,
    forma_pagamento: transaction.payment,
    parcelas: transaction.installmentCount ?? 1,
    parcela_atual: transaction.installmentNumber ?? 1,
    grupo_parcela_id: transaction.installmentGroupId || null,
    responsavel: transaction.responsible,
  };
}

export type SupabaseTransactionRow = {
  id: string;
  descricao: string | null;
  valor: number;
  data: string;
  tipo: "receita" | "despesa";
  forma_pagamento: string | null;
  parcelas: number | null;
  parcela_atual: number | null;
  grupo_parcela_id: string | null;
  responsavel: string;
  subcategoria_id: string | null;
  categorias?: { nome: string } | null;
  subcategorias?: { nome: string } | null;
};

export async function listSupabaseTransactions(): Promise<SupabaseTransactionRow[]> {
  const { data, error } = await getSupabaseClient()
    .from("transacoes")
    .select("*, categorias(nome), subcategorias(nome)")
    .order("data", { ascending: false });
  if (error) {
    throw new Error(`Não foi possível carregar as transações do Supabase: ${error.message}`);
  }
  return (data ?? []).map((row: any) => ({
    ...row,
    valor: Number(row.valor),
    data: String(row.data).slice(0, 10),
    tipo: normalizeSupabaseType(row.tipo),
  }));
}

export function normalizeSupabaseType(value: unknown): "receita" | "despesa" {
  const normalized = String(value ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return normalized === "receita" || normalized === "income" || normalized === "entrada" ? "receita" : "despesa";
}

export async function deleteSupabaseTransaction(id: string) {
  if (!id.trim()) throw new Error("ID de transação inválido.");
  const { error } = await getSupabaseClient().from("transacoes").delete().eq("id", id);
  if (error) throw new Error(`Não foi possível excluir a transação no Supabase: ${error.message}`);
}

export async function deleteSupabaseTransactions(ids: string[]) {
  const validIds = ids.filter((id) => id.trim().length > 0);
  if (validIds.length === 0) throw new Error("Nenhuma transação válida para excluir.");
  const { error } = await getSupabaseClient().from("transacoes").delete().in("id", validIds);
  if (error) throw new Error(`Não foi possível excluir as transações no Supabase: ${error.message}`);
}

export async function insertSupabaseTransactions(rows: SupabaseTransactionInsert[]) {
  const { data, error } = await getSupabaseClient().from("transacoes").insert(rows).select();
  if (error) {
    throw new Error(`Não foi possível salvar no Supabase: ${error.message}`);
  }
  return data ?? rows;
}

// Funções para Categorias e Subcategorias
export async function listSupabaseCategories() {
  const { data, error } = await getSupabaseClient().from("categorias").select("*").order("nome");
  if (error) throw new Error(`Erro ao listar categorias: ${error.message}`);
  return data;
}

export async function insertSupabaseCategory(name: string) {
  const { data, error } = await getSupabaseClient().from("categorias").insert([{ nome: name }]).select();
  if (error) throw new Error(`Erro ao inserir categoria: ${error.message}`);
  return data[0];
}

export async function deleteSupabaseCategory(id: string) {
  const { error } = await getSupabaseClient().from("categorias").delete().eq("id", id);
  if (error) throw new Error(`Erro ao excluir categoria: ${error.message}`);
}

export async function listSupabaseSubcategories() {
  const { data, error } = await getSupabaseClient().from("subcategorias").select("*").order("nome");
  if (error) throw new Error(`Erro ao listar subcategorias: ${error.message}`);
  return data;
}

export async function insertSupabaseSubcategory(name: string, categoryId: string) {
  const { data, error } = await getSupabaseClient().from("subcategorias").insert([{ nome: name, categoria_id: categoryId }]).select();
  if (error) throw new Error(`Erro ao inserir subcategoria: ${error.message}`);
  return data[0];
}

export async function deleteSupabaseSubcategory(id: string) {
  const { error } = await getSupabaseClient().from("subcategorias").delete().eq("id", id);
  if (error) throw new Error(`Erro ao excluir subcategoria: ${error.message}`);
}
