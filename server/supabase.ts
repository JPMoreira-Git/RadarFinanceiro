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
  installmentCount?: number;
};

export type SupabaseTransactionInsert = {
  descricao: string;
  valor: number;
  data: string;
  tipo: "receita" | "despesa";
  categoria_id: string | null;
  forma_pagamento: string | null;
  parcelas: number;
  responsavel: string;
};

export function toSupabaseTransactionRow(transaction: SupabaseTransactionInput): SupabaseTransactionInsert {
  return {
    descricao: [transaction.category, transaction.subcategory, transaction.note].filter(Boolean).join(" · "),
    valor: transaction.amount,
    data: transaction.date,
    tipo: transaction.type,
    categoria_id: null,
    forma_pagamento: transaction.payment,
    parcelas: transaction.installmentCount ?? 1,
    responsavel: transaction.responsible,
  };
}

export type SupabaseTransactionRow = {
  id: number;
  descricao: string;
  valor: number;
  data: string;
  tipo: "receita" | "despesa";
  forma_pagamento: string | null;
  parcelas: number | null;
  responsavel: string;
};

export async function listSupabaseTransactions(): Promise<SupabaseTransactionRow[]> {
  const { data, error } = await getSupabaseClient()
    .from("transacoes")
    .select("id, descricao, valor, data, tipo, forma_pagamento, parcelas, responsavel")
    .order("data", { ascending: false });
  if (error) {
    throw new Error(`Não foi possível carregar as transações do Supabase: ${error.message}`);
  }
  return (data ?? []) as SupabaseTransactionRow[];
}

export async function insertSupabaseTransactions(rows: SupabaseTransactionInsert[]) {
  const { data, error } = await getSupabaseClient().from("transacoes").insert(rows).select();
  if (error) {
    throw new Error(`Não foi possível salvar no Supabase: ${error.message}`);
  }
  return data ?? rows;
}
