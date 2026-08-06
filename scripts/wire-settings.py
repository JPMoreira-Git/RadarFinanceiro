from pathlib import Path

path = Path('/home/ubuntu/controle-financeiro-familiar/client/src/pages/Home.tsx')
s = path.read_text()

s = s.replace(
'function TransactionsView({ transactions, onDelete, onUpdate }: { transactions: Transaction[]; onDelete: (id: number) => void; onUpdate: (transaction: Transaction) => void }) {',
'function TransactionsView({ transactions, onDelete, onUpdate, categoriesData }: { transactions: Transaction[]; onDelete: (id: number) => void; onUpdate: (transaction: Transaction) => void; categoriesData: Record<string, string[]> }) {'
)
s = s.replace('Object.keys(categories).map((item) => <option key={item}>{item}</option>)', 'Object.keys(categoriesData).map((item) => <option key={item}>{item}</option>)', 1)

s = s.replace(
'function NewTransaction({ onAdd }: { onAdd: (transaction: Transaction) => void }) {',
'function NewTransaction({ onAdd, categoriesData, payments }: { onAdd: (transaction: Transaction) => void; categoriesData: Record<string, string[]>; payments: string[] }) {'
)
s = s.replace('categories[value][0]', 'categoriesData[value][0]')
s = s.replace('Object.keys(categories).map((item) => <option key={item}>{item}</option>)', 'Object.keys(categoriesData).map((item) => <option key={item}>{item}</option>)', 1)
s = s.replace('categories[form.category].map((item) => <option key={item}>{item}</option>)', 'categoriesData[form.category].map((item) => <option key={item}>{item}</option>)')
s = s.replace('<option>Conta conjunta</option><option>Cartão principal</option><option>Débito automático</option><option>Conta investimentos</option><option>Dinheiro</option>', '{payments.map((item) => <option key={item}>{item}</option>)}')

s = s.replace(
'function SettingsView() {\n  const [customCategories, setCustomCategories] = useState<Record<string, string[]>>({ ...categories });\n  const [newCategory, setNewCategory] = useState("");\n  const [newPayment, setNewPayment] = useState("");\n  const [payments, setPayments] = useState(["Conta conjunta", "Cartão principal", "Conta investimentos", "Débito automático"]);',
'''function SettingsView({ categoriesData, onAddCategory, onAddSubcategory, onRemoveSubcategory, payments, onAddPayment, onRemovePayment }: { categoriesData: Record<string, string[]>; onAddCategory: (name: string) => void; onAddSubcategory: (category: string, subcategory: string) => void; onRemoveSubcategory: (category: string, subcategory: string) => void; payments: string[]; onAddPayment: (name: string) => void; onRemovePayment: (name: string) => void }) {
  const [newCategory, setNewCategory] = useState("");
  const [newSubcategory, setNewSubcategory] = useState("");
  const [subcategoryCategory, setSubcategoryCategory] = useState(Object.keys(categoriesData)[0] ?? "");
  const [newPayment, setNewPayment] = useState("");'''
)
s = s.replace('Object.entries(customCategories)', 'Object.entries(categoriesData)')
s = s.replace('{subs.join(" · ")}', '{subs.map((sub) => <span key={sub} className="mr-2 inline-flex items-center gap-1 rounded-md bg-white px-2 py-1 text-xs text-[#688078]">{sub}<button type="button" onClick={() => onRemoveSubcategory(category, sub)} className="text-[#a55348]" aria-label={`Remover ${sub}`}>×</button></span>)}')
s = s.replace('setCustomCategories((current) => ({ ...current, [value]: ["Geral"] })); setNewCategory("");', 'onAddCategory(value); setNewCategory("");')
s = s.replace('setPayments((current) => [...current, value]); setNewPayment("");', 'onAddPayment(value); setNewPayment("");')
s = s.replace('<PaymentRow key={payment} label={payment} detail={payment.includes("Conta") ? "Conta ou carteira" : "Cartão ou recorrência"} />', '<PaymentRow key={payment} label={payment} detail={payment.includes("Conta") ? "Conta ou carteira" : "Cartão ou recorrência"} onRemove={() => onRemovePayment(payment)} />')
old = '<div className="mt-4 flex gap-2"><Input value={newCategory} onChange={(event) => setNewCategory(event.target.value)} placeholder="Nova categoria..." className="h-10 rounded-xl border-[#dfe9e2]" /><Button onClick={() => { const value = newCategory.trim(); if (!value) return; onAddCategory(value); setNewCategory(""); toast.success("Categoria adicionada."); }} variant="outline" className="h-10 rounded-xl border-[#dfe9e2]"><Plus className="h-4 w-4" /></Button></div>'
new = old + '<div className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_auto]"><select value={subcategoryCategory} onChange={(event) => setSubcategoryCategory(event.target.value)} className="h-10 rounded-xl border border-[#dfe9e2] bg-white px-3 text-sm text-[#557067]">{Object.keys(categoriesData).map((item) => <option key={item}>{item}</option>)}</select><Input value={newSubcategory} onChange={(event) => setNewSubcategory(event.target.value)} placeholder="Nova subcategoria..." className="h-10 rounded-xl border-[#dfe9e2]" /><Button onClick={() => { const value = newSubcategory.trim(); if (!value) return; onAddSubcategory(subcategoryCategory, value); setNewSubcategory(""); toast.success("Subcategoria adicionada."); }} variant="outline" className="h-10 rounded-xl border-[#dfe9e2]"><Plus className="h-4 w-4" /></Button></div>'
s = s.replace(old, new)

s = s.replace('function PaymentRow({ label, detail }: { label: string; detail: string }) { return <div', 'function PaymentRow({ label, detail, onRemove }: { label: string; detail: string; onRemove: () => void }) { return <div')
s = s.replace('<Ellipsis className="h-4 w-4 text-[#b2beb7]" /></div>; }', '<button type="button" onClick={onRemove} className="rounded-md p-1 text-[#b2beb7] hover:bg-[#f8e8e5] hover:text-[#a55348]" aria-label={`Remover ${label}`}><X className="h-4 w-4" /></button></div>; }')

old_main = '  const [transactions, setTransactions] = useState(seedTransactions);\n  const addTransaction = (transaction: Transaction) => setTransactions((current) => [transaction, ...current]);'
new_main = '''  const [transactions, setTransactions] = useState(seedTransactions);
  const [categoriesData, setCategoriesData] = useState<Record<string, string[]>>({ ...categories });
  const [payments, setPayments] = useState(["Conta conjunta", "Cartão principal", "Conta investimentos", "Débito automático"]);
  const addTransaction = (transaction: Transaction) => setTransactions((current) => [transaction, ...current]);
  const addCategory = (name: string) => setCategoriesData((current) => current[name] ? current : { ...current, [name]: ["Geral"] });
  const addSubcategory = (category: string, subcategory: string) => setCategoriesData((current) => ({ ...current, [category]: current[category]?.includes(subcategory) ? current[category] : [...(current[category] ?? []), subcategory] }));
  const removeSubcategory = (category: string, subcategory: string) => setCategoriesData((current) => ({ ...current, [category]: (current[category] ?? []).filter((item) => item !== subcategory) }));
  const addPayment = (name: string) => setPayments((current) => current.includes(name) ? current : [...current, name]);
  const removePayment = (name: string) => setPayments((current) => current.filter((item) => item !== name));'''
s = s.replace(old_main, new_main)
s = s.replace('<TransactionsView transactions={transactions} onDelete={deleteTransaction} onUpdate={updateTransaction} />', '<TransactionsView transactions={transactions} onDelete={deleteTransaction} onUpdate={updateTransaction} categoriesData={categoriesData} />')
s = s.replace('<NewTransaction onAdd={addTransaction} />', '<NewTransaction onAdd={addTransaction} categoriesData={categoriesData} payments={payments} />')
s = s.replace('<SettingsView />', '<SettingsView categoriesData={categoriesData} onAddCategory={addCategory} onAddSubcategory={addSubcategory} onRemoveSubcategory={removeSubcategory} payments={payments} onAddPayment={addPayment} onRemovePayment={removePayment} />')
path.write_text(s)
