# Integração Supabase — tabela `transacoes`

A integração usa o endpoint REST do projeto Supabase configurado em `SUPABASE_URL`, com a chave pública armazenada em `SUPABASE_ANON_KEY` e acessada somente no backend.

## Schema confirmado

As colunas públicas confirmadas por consultas `GET` não destrutivas são:

| Coluna | Origem no formulário | Tratamento |
|---|---|---|
| `id` | Gerado pelo Supabase | Não enviado pelo app |
| `descricao` | Categoria + subcategoria + observação | Como a tabela não possui colunas separadas para esses três valores, eles são concatenados com ` · ` |
| `valor` | Valor | Enviado como número |
| `data` | Data / primeira parcela | Enviada no formato `YYYY-MM-DD` |
| `tipo` | Receita ou despesa | Enviado como `receita` ou `despesa` |
| `categoria_id` | Categoria | Atualmente `null`, pois o app trabalha com nomes locais e não existe no contrato disponível um catálogo Supabase de categorias/IDs |
| `forma_pagamento` | Forma de pagamento | Nulo para receitas; valor selecionado para despesas |
| `parcelas` | Quantidade total de parcelas | Usa `1` quando não há parcelamento |
| `responsavel` | João Paulo, Danieli ou Ambos | Enviado como texto |
| `criado_em` | Gerado pelo Supabase | Não enviado pelo app |

A coluna `categoria_id` foi validada como opcional no schema atual: o Supabase não a reportou como restrição `NOT NULL`. Portanto, o envio de `null` é compatível com o contrato atual. Para preencher essa coluna no futuro, será necessário criar ou disponibilizar um catálogo de categorias no Supabase e um mapeamento estável entre os nomes locais e seus IDs.

## Parcelas e atomicidade

O formulário gera as parcelas no cliente, mas envia todas em uma única chamada `transactions.create`. O backend converte o lote e executa um único `insert` no Supabase, evitando que uma compra parcelada seja gravada parcialmente por múltiplas chamadas independentes.
