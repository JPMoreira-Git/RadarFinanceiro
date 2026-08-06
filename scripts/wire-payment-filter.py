from pathlib import Path

path = Path('/home/ubuntu/controle-financeiro-familiar/client/src/pages/Home.tsx')
s = path.read_text()
s = s.replace(
'function TransactionsView({ transactions, onDelete, onUpdate, categoriesData }: { transactions: Transaction[]; onDelete: (id: number) => void; onUpdate: (transaction: Transaction) => void; categoriesData: Record<string, string[]> }) {',
'function TransactionsView({ transactions, onDelete, onUpdate, categoriesData, payments }: { transactions: Transaction[]; onDelete: (id: number) => void; onUpdate: (transaction: Transaction) => void; categoriesData: Record<string, string[]>; payments: string[] }) {'
)
s = s.replace('  const [responsible, setResponsible] = useState("Todos");\n  const [month, setMonth]', '  const [responsible, setResponsible] = useState("Todos");\n  const [payment, setPayment] = useState("Todos");\n  const [month, setMonth]')
s = s.replace('(responsible === "Todos" || item.responsible === responsible) && `${item.category}', '(responsible === "Todos" || item.responsible === responsible) && (payment === "Todos" || item.payment === payment) && `${item.category}')
s = s.replace('  const [editNote, setEditNote] = useState("");', '  const [editNote, setEditNote] = useState("");\n  const [editPayment, setEditPayment] = useState("");')
s = s.replace('setEditNote(item.note); };', 'setEditNote(item.note); setEditPayment(item.payment); };')
s = s.replace('onUpdate({ ...item, amount, note: editNote });', 'onUpdate({ ...item, amount, note: editNote, payment: editPayment });')
s = s.replace('<Field label="Observação"><Input value={editNote}', '<Field label="Forma de pagamento"><select value={editPayment} onChange={(event) => setEditPayment(event.target.value)} className="h-10 rounded-lg border border-[#dfe9e2] bg-white px-3 text-sm text-[#31584b]">{payments.map((option) => <option key={option}>{option}</option>)}</select></Field><Field label="Observação"><Input value={editNote}')
needle = '<select value={responsible} onChange={(event) => setResponsible(event.target.value)} className="h-11 rounded-xl border border-[#dfe9e2] bg-white px-3 text-sm text-[#557067]"><option>Todos</option><option>Você</option><option>Esposa</option><option>Ambos</option></select>'
replacement = needle + '<select value={payment} onChange={(event) => setPayment(event.target.value)} className="h-11 rounded-xl border border-[#dfe9e2] bg-white px-3 text-sm text-[#557067]"><option>Todos</option>{payments.map((option) => <option key={option}>{option}</option>)}</select>'
s = s.replace(needle, replacement)
s = s.replace('categoriesData={categoriesData} />', 'categoriesData={categoriesData} payments={payments} />')
path.write_text(s)
