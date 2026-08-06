import fs from 'node:fs';

const path = '/home/ubuntu/controle-financeiro-familiar/client/src/pages/Home.tsx';
let s = fs.readFileSync(path, 'utf8');
s = s.replace('import { summarizeTransactions } from "@shared/finance";', 'import { installmentDate, splitInstallments, summarizeTransactions } from "@shared/finance";');
s = s.replace('  note: string;\n};', '  note: string;\n  installmentGroupId?: string;\n  installmentNumber?: number;\n  installmentCount?: number;\n};');
s = s.replace('  const [form, setForm] = useState({ date: "2026-08-06", type: "despesa" as TransactionType, amount: "", category: "Moradia", subcategory: "Aluguel", responsible: "Você", payment: "Conta conjunta", note: "" });\n  const update = (key: string, value: string) => setForm((current) => ({ ...current, [key]: value, ...(key === "category" ? { subcategory: categoriesData[value][0] } : {}) }));\n  const submit = (event: React.FormEvent) => { event.preventDefault(); const amount = Number(form.amount.replace(",", ".")); if (!amount || amount <= 0) { toast.error("Informe um valor válido para o lançamento."); return; } onAdd({ id: Date.now(), date: form.date, type: form.type, amount, category: form.category, subcategory: form.subcategory, responsible: form.responsible, payment: form.payment, note: form.note }); toast.success("Lançamento adicionado ao resumo."); setForm((current) => ({ ...current, amount: "", note: "" })); };', `  const [form, setForm] = useState({ date: "2026-08-06", type: "despesa" as TransactionType, amount: "", category: "Moradia", subcategory: "Aluguel", responsible: "Você", payment: "Conta conjunta", note: "", installments: "1" });
  const availableCategories = form.type === "receita" ? { Receitas: categoriesData.Receitas ?? [] } : Object.fromEntries(Object.entries(categoriesData).filter(([name]) => name !== "Receitas"));
  const update = (key: string, value: string) => setForm((current) => {
    if (key === "type") {
      const nextCategories = value === "receita" ? { Receitas: categoriesData.Receitas ?? [] } : Object.fromEntries(Object.entries(categoriesData).filter(([name]) => name !== "Receitas"));
      const nextCategory = Object.keys(nextCategories)[0] ?? "";
      return { ...current, type: value as TransactionType, category: nextCategory, subcategory: nextCategories[nextCategory]?.[0] ?? "" };
    }
    return { ...current, [key]: value, ...(key === "category" ? { subcategory: categoriesData[value]?.[0] ?? "" } : {}) };
  });
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const amount = Number(form.amount.replace(",", "."));
    const installments = Math.max(1, Math.min(60, Number(form.installments) || 1));
    if (!amount || amount <= 0) { toast.error("Informe um valor válido para o lançamento."); return; }
    const values = splitInstallments(amount, installments);
    const groupId = installments > 1 ? \`parcelado-\${Date.now()}\` : undefined;
    values.forEach((value, index) => onAdd({ id: Date.now() + index, date: installmentDate(form.date, index), type: form.type, amount: value, category: form.category, subcategory: form.subcategory, responsible: form.responsible, payment: form.payment, note: installments > 1 ? \`Parcela \${index + 1}/\${installments}\${form.note ? \` · \${form.note}\` : ""}\` : form.note, installmentGroupId: groupId, installmentNumber: installments > 1 ? index + 1 : undefined, installmentCount: installments > 1 ? installments : undefined }));
    toast.success(installments > 1 ? \`Compra dividida em \${installments} parcelas.\` : "Lançamento adicionado ao resumo.");
    setForm((current) => ({ ...current, amount: "", note: "", installments: "1" }));
  };`);
s = s.replace('{Object.keys(categoriesData).map((item) => <option key={item}>{item}</option>)}', '{Object.keys(availableCategories).map((item) => <option key={item}>{item}</option>)}', 1);
s = s.replace('{categoriesData[form.category].map((item) => <option key={item}>{item}</option>)}', '{(availableCategories[form.category] ?? []).map((item) => <option key={item}>{item}</option>)}');
s = s.replace('<Field label="Forma de pagamento"><select value={form.payment} onChange={(event) => update("payment", event.target.value)} className="h-12 w-full rounded-xl border border-[#dfe9e2] bg-[#fbfcfb] px-3 text-sm text-[#31584b] outline-none focus:border-[#9a6b43]">{payments.map((item) => <option key={item}>{item}</option>)}</select></Field></div><Field label="Observação">', '<Field label="Forma de pagamento"><select value={form.payment} onChange={(event) => update("payment", event.target.value)} className="h-12 w-full rounded-xl border border-[#dfe9e2] bg-[#fbfcfb] px-3 text-sm text-[#31584b] outline-none focus:border-[#9a6b43]">{payments.map((item) => <option key={item}>{item}</option>)}</select></Field>{form.type === "despesa" && form.payment.toLowerCase().includes("cartão") && <Field label="Número de parcelas"><Input type="number" min="1" max="60" value={form.installments} onChange={(event) => update("installments", event.target.value)} className="h-12 rounded-xl border-[#dfe9e2] bg-[#fbfcfb] text-[#31584b]" /></Field>}</div><p className="text-xs text-[#8b9c94]">A data informada representa a primeira parcela. As demais serão lançadas nos meses seguintes.</p><Field label="Observação">');
fs.writeFileSync(path, s);
