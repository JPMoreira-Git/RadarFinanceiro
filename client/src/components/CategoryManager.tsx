import { useState } from "react";
import { GripVertical, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type CategoryManagerProps = {
  categories: Record<string, string[]>;
  onAddCategory: (name: string) => void;
  onAddSubcategory: (category: string, name: string) => void;
  onRenameCategory: (oldName: string, newName: string) => void;
  onRenameSubcategory: (category: string, oldName: string, newName: string) => void;
  onRemoveCategory: (name: string) => void;
  onRemoveSubcategory: (category: string, name: string) => void;
  onReorderCategory: (from: string, to: string) => void;
  onReorderSubcategory: (category: string, from: string, to: string) => void;
};

export default function CategoryManager({ categories, onAddCategory, onAddSubcategory, onRenameCategory, onRenameSubcategory, onRemoveCategory, onRemoveSubcategory, onReorderCategory, onReorderSubcategory }: CategoryManagerProps) {
  const [newCategory, setNewCategory] = useState("");
  const [newSubcategory, setNewSubcategory] = useState("");
  const [subcategoryCategory, setSubcategoryCategory] = useState(Object.keys(categories)[0] ?? "");
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [editingSubcategory, setEditingSubcategory] = useState<string | null>(null);
  const [categoryDraft, setCategoryDraft] = useState("");
  const [subcategoryDraft, setSubcategoryDraft] = useState("");
  const [dragCategory, setDragCategory] = useState<string | null>(null);
  const [dragSubcategory, setDragSubcategory] = useState<{ category: string; name: string } | null>(null);

  const startCategoryEdit = (name: string) => { setEditingCategory(name); setCategoryDraft(name); };
  const startSubcategoryEdit = (category: string, name: string) => { setEditingSubcategory(`${category}:${name}`); setSubcategoryDraft(name); };
  const saveCategory = (name: string) => { onRenameCategory(name, categoryDraft); setEditingCategory(null); };
  const saveSubcategory = (category: string, name: string) => { onRenameSubcategory(category, name, subcategoryDraft); setEditingSubcategory(null); };

  return (
    <Card className="rounded-2xl border-[#e0e9e3] bg-white shadow-[0_8px_30px_rgba(30,62,48,0.04)]">
      <CardHeader className="p-5 pb-3">
        <CardTitle className="font-display text-lg text-[#173f35]">Categorias e subcategorias</CardTitle>
        <p className="mt-1 text-xs leading-5 text-[#8b9c94]">Edite nomes, exclua itens sem histórico e arraste para ordenar por frequência de uso.</p>
      </CardHeader>
      <CardContent className="p-5 pt-2">
        <div className="space-y-3">
          {Object.entries(categories).map(([category, subs]) => (
            <div key={category} draggable onDragStart={() => setDragCategory(category)} onDragOver={(event) => event.preventDefault()} onDrop={() => { if (dragCategory && dragCategory !== category) onReorderCategory(dragCategory, category); setDragCategory(null); }} className="rounded-xl bg-[#f7faf8] p-3">
              <div className="flex items-center gap-2">
                <GripVertical className="h-4 w-4 shrink-0 cursor-grab text-[#a9b7af]" aria-label="Arrastar categoria" />
                {editingCategory === category ? <Input autoFocus value={categoryDraft} onChange={(event) => setCategoryDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") saveCategory(category); if (event.key === "Escape") setEditingCategory(null); }} className="h-8 flex-1 rounded-lg border-[#dfe9e2] bg-white text-sm" /> : <p className="flex-1 text-sm font-semibold text-[#31584b]">{category}</p>}
                <span className="text-[10px] font-bold text-[#9aa9a2]">{subs.length}</span>
                {editingCategory === category ? <Button type="button" onClick={() => saveCategory(category)} variant="outline" className="h-8 rounded-lg border-[#dfe9e2] px-2 text-[#297059]">Salvar</Button> : <button type="button" onClick={() => startCategoryEdit(category)} className="rounded-md p-1 text-[#83938b] hover:bg-white hover:text-[#173f35]" aria-label={`Editar ${category}`}><Pencil className="h-4 w-4" /></button>}
                <button type="button" onClick={() => onRemoveCategory(category)} className="rounded-md p-1 text-[#b2beb7] hover:bg-[#f8e8e5] hover:text-[#a55348]" aria-label={`Excluir ${category}`}><Trash2 className="h-4 w-4" /></button>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {subs.map((sub) => {
                  const key = `${category}:${sub}`;
                  return <span key={key} draggable onDragStart={() => setDragSubcategory({ category, name: sub })} onDragOver={(event) => event.preventDefault()} onDrop={() => { if (dragSubcategory && dragSubcategory.category === category && dragSubcategory.name !== sub) onReorderSubcategory(category, dragSubcategory.name, sub); setDragSubcategory(null); }} className="inline-flex items-center gap-1 rounded-md bg-white px-2 py-1 text-xs text-[#688078]"><GripVertical className="h-3 w-3 cursor-grab text-[#b2beb7]" aria-label="Arrastar subcategoria" />{editingSubcategory === key ? <Input autoFocus value={subcategoryDraft} onChange={(event) => setSubcategoryDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") saveSubcategory(category, sub); if (event.key === "Escape") setEditingSubcategory(null); }} className="h-6 w-28 rounded-md border-[#dfe9e2] bg-[#fbfcfb] px-1 text-xs" /> : <span>{sub}</span>}{editingSubcategory === key ? <button type="button" onClick={() => saveSubcategory(category, sub)} className="text-[#297059]" aria-label={`Salvar ${sub}`}>✓</button> : <button type="button" onClick={() => startSubcategoryEdit(category, sub)} className="text-[#9aa9a2] hover:text-[#173f35]" aria-label={`Editar ${sub}`}><Pencil className="h-3 w-3" /></button>}<button type="button" onClick={() => onRemoveSubcategory(category, sub)} className="text-[#a55348]" aria-label={`Remover ${sub}`}>×</button></span>;
                })}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 flex gap-2"><Input value={newCategory} onChange={(event) => setNewCategory(event.target.value)} placeholder="Nova categoria..." className="h-10 rounded-xl border-[#dfe9e2]" /><Button onClick={() => { const value = newCategory.trim(); if (!value) return; onAddCategory(value); setNewCategory(""); }} variant="outline" className="h-10 rounded-xl border-[#dfe9e2]"><Plus className="h-4 w-4" /></Button></div>
        <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_auto]"><select value={subcategoryCategory} onChange={(event) => setSubcategoryCategory(event.target.value)} className="h-10 rounded-xl border border-[#dfe9e2] bg-white px-3 text-sm text-[#557067]">{Object.keys(categories).map((item) => <option key={item}>{item}</option>)}</select><Input value={newSubcategory} onChange={(event) => setNewSubcategory(event.target.value)} placeholder="Nova subcategoria..." className="h-10 rounded-xl border-[#dfe9e2]" /><Button onClick={() => { const value = newSubcategory.trim(); if (!value) return; onAddSubcategory(subcategoryCategory, value); setNewSubcategory(""); }} variant="outline" className="h-10 rounded-xl border-[#dfe9e2]"><Plus className="h-4 w-4" /></Button></div>
      </CardContent>
    </Card>
  );
}
