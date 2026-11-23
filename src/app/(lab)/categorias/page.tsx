import { Plus } from "lucide-react";
import { CategoryTree } from "@/components/category-tree";
import { StateView } from "@/components/state-view";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { db } from "@/server/db";
import { pageContext } from "@/server/context";
import { listCategoryTree } from "@/server/queries";

type Node = { id: string; name: string; children: Node[] };

function isIncome(name: string) {
  return /ingreso/i.test(name);
}

export default async function CategoriesPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const session = await pageContext();
  const params = await searchParams;
  if (!session.companyId) return <StateView variant="empty" title="Selecciona una empresa para editar sus categorías." />;
  const companyId = session.companyId;
  const tree = await listCategoryTree((await db()), session.actor, companyId);
  const movements = await (await db()).bankTransaction.findMany({
    where: { companyId },
    select: { amountCents: true, classification: { select: { categoryId: true, subcategoryId: true } } },
  });
  const spent = new Map<string, { income: number; expense: number }>();
  const add = (id: string | null | undefined, amount: number) => {
    if (!id || amount === 0) return;
    const current = spent.get(id) ?? { income: 0, expense: 0 };
    if (amount > 0) current.income += amount;
    else current.expense += Math.abs(amount);
    spent.set(id, current);
  };
  for (const row of movements) {
    add(row.classification?.categoryId, row.amountCents);
    add(row.classification?.subcategoryId, row.amountCents);
  }
  const amounts: Record<string, number> = {};
  const fill = (node: Node, income: boolean) => {
    const bucket = spent.get(node.id);
    amounts[node.id] = income ? (bucket?.income ?? 0) : (bucket?.expense ?? 0);
    node.children.forEach((child) => fill(child, income));
  };
  for (const parent of tree) fill(parent, isIncome(parent.name));
  const subtotal = tree.reduce((sum, parent) => sum + parent.children.length, 0);
  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Categorías</h1>
          <p className="mt-1 text-sm text-slate-500">
            {tree.length} categorías · {subtotal} subcategorías. Enter guarda el nombre. El + agrega una subcategoría. Arrastra una subcategoría a otra categoría para moverla.
          </p>
        </div>
        <form action="/api/categories" method="post" className="flex items-end gap-2">
          <input type="hidden" name="companyId" value={companyId} />
          <label className="text-xs text-slate-500">
            Nueva categoría
            <Input name="name" placeholder="Nombre" className="mt-1" />
          </label>
          <Button type="submit" className="gap-1"><Plus className="size-4" /> Agregar</Button>
        </form>
      </div>
      {params.error ? <StateView variant="error" title={params.error} testId="server-error" /> : null}
      {tree.length === 0 ? <StateView variant="empty" title="Esta empresa no tiene categorías." /> : (
        <CategoryTree companyId={companyId} tree={tree} amounts={amounts} />
      )}
    </section>
  );
}
