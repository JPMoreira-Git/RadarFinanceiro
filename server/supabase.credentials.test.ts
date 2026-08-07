import { describe, expect, it } from "vitest";

describe("Supabase credentials", () => {
  it("aceita a chave configurada no endpoint REST", async () => {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_ANON_KEY;
    expect(url).toBeTruthy();
    expect(key).toBeTruthy();

    const response = await fetch(`${url}/rest/v1/`, {
      headers: {
        apikey: key!,
        Authorization: `Bearer ${key}`,
      },
    });

    expect(response.status).toBeLessThan(500);

    const columns = "id,descricao,valor,data,tipo,categoria_id,forma_pagamento,parcelas,responsavel,criado_em";
    const tableResponse = await fetch(`${url}/rest/v1/transacoes?select=${columns}&limit=1`, {
      headers: {
        apikey: key!,
        Authorization: `Bearer ${key}`,
      },
    });
    expect(tableResponse.status).toBe(200);
  }, 15_000);
});

export {};
