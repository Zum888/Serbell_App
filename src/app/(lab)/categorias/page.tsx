import { FolderTree, Plus } from "lucide-react";
import Link from "next/link";
import { StateView } from "@/components/state-view";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatUsd } from "@/lib/money";
import { db } from "@/server/db";
import { pageContext } from "@/server/context";
import { listCategoryTree } from "@/server/queries";

type Node = { id: string; name: string; children: Node[] };
type Parent = Node;

function isIncome(name: string) {
  return /ingreso/i.test(name);
}

export default async function CategoriesPage({ searchParams }: { searchParams: Promise<{ error?: string; vista?: string }> }) {
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
  const subtotal = tree.reduce((sum, parent) => sum + parent.children.length, 0);
  const statement = params.vista === "estado";
  const incomeParents = tree.filter((parent) => isIncome(parent.name));
  const expenseParents = tree.filter((parent) => !isIncome(parent.name));
  const incomeTotal = incomeParents.reduce((sum, parent) => sum + (spent.get(parent.id)?.income ?? 0), 0);
  const expenseTotal = expenseParents.reduce((sum, parent) => sum + (spent.get(parent.id)?.expense ?? 0), 0);
  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Categorías</h1>
          <p className="mt-1 text-sm text-slate-500">
            {tree.length} categorías · {subtotal} subcategorías. Cambiar un nombre no reescribe el historial.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex rounded-full border border-border bg-white p-1 text-xs">
            <Link href="/categorias" className={!statement ? "rounded-full bg-slate-900 px-3 py-1.5 text-white" : "rounded-full px-3 py-1.5 text-slate-600"}>
              Árbol
            </Link>
            <Link href="/categorias?vista=estado" className={statement ? "rounded-full bg-slate-900 px-3 py-1.5 text-white" : "rounded-full px-3 py-1.5 text-slate-600"}>
              Estado de resultados
            </Link>
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
      </div>
      {params.error ? <StateView variant="error" title={params.error} testId="server-error" /> : null}
      {tree.length === 0 ? <StateView variant="empty" title="Esta empresa no tiene categorías." /> : null}
      {statement ? (
        <div className="space-y-4">
          <StatementBlock title="Ingresos" parents={incomeParents} companyId={companyId} spent={spent} total={incomeTotal} income />
          <StatementBlock title="Gastos" parents={expenseParents} companyId={companyId} spent={spent} total={expenseTotal} income={false} />
          <article className="flex items-center justify-between rounded-2xl bg-slate-950 px-5 py-4 text-white">
            <p className="text-sm text-slate-300">Resultado del periodo</p>
            <p className="text-2xl font-semibold tracking-tight tabular-nums">{formatUsd(incomeTotal - expenseTotal)}</p>
          </article>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {tree.map((parent) => (
            <CategoryCard key={parent.id} parent={parent} companyId={companyId} spent={spent} />
          ))}
        </div>
      )}
    </section>
  );
}

function StatementBlock({
  title,
  parents,
  companyId,
  spent,
  total,
  income,
}: {
  title: string;
  parents: Parent[];
  companyId: string;
  spent: Map<string, { income: number; expense: number }>;
  total: number;
  income: boolean;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-white">
      <header className="flex items-center justify-between border-b border-border px-5 py-3">
        <h2 className="text-sm font-semibold">{title}</h2>
        <p className="text-sm font-semibold tabular-nums">{formatUsd(total)}</p>
      </header>
      <div className="divide-y divide-border">
        {parents.map((parent) => (
          <CategoryCard key={parent.id} parent={parent} companyId={companyId} spent={spent} flat income={income} />
        ))}
      </div>
    </section>
  );
}

function amountOf(spent: Map<string, { income: number; expense: number }>, id: string, income?: boolean) {
  const bucket = spent.get(id);
  if (!bucket) return 0;
  if (income === true) return bucket.income;
  if (income === false) return bucket.expense;
  return bucket.income || bucket.expense;
}

function CategoryCard({
  parent,
  companyId,
  spent,
  flat,
  income,
}: {
  parent: Parent;
  companyId: string;
  spent: Map<string, { income: number; expense: number }>;
  flat?: boolean;
  income?: boolean;
}) {
  return (
    <article className={flat ? "" : "rounded-2xl border border-border bg-white"}>
      <header className="flex items-center gap-2 px-4 py-3">
        {flat ? null : <FolderTree className="size-4 text-primary" />}
        <form action={`/api/categories/${parent.id}`} method="post" className="flex flex-1 items-center gap-2">
          <Input name="name" defaultValue={parent.name} aria-label={`Nombre de ${parent.name}`} className="h-9 border-0 px-0 text-base font-semibold shadow-none focus-visible:ring-0" />
          <button type="submit" className="text-xs font-medium text-slate-500 hover:text-primary">Renombrar</button>
        </form>
        <span className="text-sm font-medium tabular-nums text-slate-700">{formatUsd(amountOf(spent, parent.id, income))}</span>
      </header>
      <ul className="divide-y divide-border">
        {parent.children.length === 0 ? (
          <li className="px-4 py-3 text-xs text-slate-400">Sin subcategorías todavía.</li>
        ) : (
          parent.children.map((child) => (
            <li key={child.id} className="px-4 py-2">
              <div className="flex items-center gap-2">
                <form action={`/api/categories/${child.id}`} method="post" className="flex flex-1 items-center gap-2">
                  <span className="text-slate-300">—</span>
                  <Input name="name" defaultValue={child.name} aria-label={`Nombre de ${child.name}`} className="h-8 border-0 px-0 text-sm shadow-none focus-visible:ring-0" />
                  <button type="submit" className="text-xs text-slate-400 hover:text-primary">Renombrar</button>
                </form>
                <span className="text-xs tabular-nums text-slate-500">{formatUsd(amountOf(spent, child.id, income))}</span>
              </div>
              {child.children.length > 0 ? (
                <ul className="mt-1 space-y-1 pl-6">
                  {child.children.map((detail) => (
                    <li key={detail.id} className="flex items-center gap-2">
                      <form action={`/api/categories/${detail.id}`} method="post" className="flex flex-1 items-center gap-2">
                        <span className="text-slate-300">··</span>
                        <Input name="name" defaultValue={detail.name} aria-label={`Nombre de ${detail.name}`} className="h-8 border-0 px-0 text-sm shadow-none focus-visible:ring-0" />
                        <button type="submit" className="text-xs text-slate-400 hover:text-primary">Renombrar</button>
                      </form>
                      <span className="text-xs tabular-nums text-slate-500">{formatUsd(amountOf(spent, detail.id, income))}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          ))
        )}
      </ul>
      <form action="/api/categories" method="post" className="flex items-center gap-2 border-t border-border px-4 py-3">
        <input type="hidden" name="companyId" value={companyId} />
        <input type="hidden" name="parentId" value={parent.id} />
        <Plus className="size-4 text-slate-400" />
        <Input name="name" placeholder="Nueva subcategoría" className="h-8" />
        <Button type="submit" variant="outline" className="h-8">Agregar</Button>
      </form>
    </article>
  );
}
