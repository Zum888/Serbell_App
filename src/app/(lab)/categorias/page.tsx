import { FolderTree, Plus } from "lucide-react";
import { StateView } from "@/components/state-view";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { db } from "@/server/db";
import { pageContext } from "@/server/context";
import { listCategoryTree } from "@/server/queries";

export default async function CategoriesPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const session = await pageContext();
  const params = await searchParams;
  if (!session.companyId) return <StateView variant="empty" title="Selecciona una empresa para editar sus categorías." />;
  const tree = await listCategoryTree((await db()), session.actor, session.companyId);
  const subtotal = tree.reduce((sum, parent) => sum + parent.children.length, 0);
  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Categorías</h1>
          <p className="mt-1 text-sm text-slate-500">
            {tree.length} categorías · {subtotal} subcategorías. Cambiar un nombre no reescribe el historial.
          </p>
        </div>
        <form action="/api/categories" method="post" className="flex items-end gap-2">
          <input type="hidden" name="companyId" value={session.companyId} />
          <label className="text-xs text-slate-500">
            Nueva categoría
            <Input name="name" placeholder="Nombre" className="mt-1" />
          </label>
          <Button type="submit" className="gap-1"><Plus className="size-4" /> Agregar</Button>
        </form>
      </div>
      {params.error ? <StateView variant="error" title={params.error} testId="server-error" /> : null}
      {tree.length === 0 ? <StateView variant="empty" title="Esta empresa no tiene categorías." /> : null}
      <div className="grid gap-4 lg:grid-cols-2">
        {tree.map((parent) => (
          <article key={parent.id} className="rounded-2xl border border-border bg-white">
            <header className="flex items-center gap-2 border-b border-border px-4 py-3">
              <FolderTree className="size-4 text-primary" />
              <form action={`/api/categories/${parent.id}`} method="post" className="flex flex-1 items-center gap-2">
                <Input name="name" defaultValue={parent.name} aria-label={`Nombre de ${parent.name}`} className="h-9 border-0 px-0 text-base font-semibold shadow-none focus-visible:ring-0" />
                <button type="submit" className="text-xs font-medium text-slate-500 hover:text-primary">Renombrar</button>
              </form>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">{parent.children.length}</span>
            </header>
            <ul className="divide-y divide-border">
              {parent.children.length === 0 ? (
                <li className="px-4 py-3 text-xs text-slate-400">Sin subcategorías todavía.</li>
              ) : (
                parent.children.map((child) => (
                  <li key={child.id} className="px-4 py-2">
                    <form action={`/api/categories/${child.id}`} method="post" className="flex items-center gap-2">
                      <span className="text-slate-300">—</span>
                      <Input name="name" defaultValue={child.name} aria-label={`Nombre de ${child.name}`} className="h-8 border-0 px-0 text-sm shadow-none focus-visible:ring-0" />
                      <button type="submit" className="text-xs text-slate-400 hover:text-primary">Renombrar</button>
                    </form>
                  </li>
                ))
              )}
            </ul>
            <form action="/api/categories" method="post" className="flex items-center gap-2 border-t border-border px-4 py-3">
              <input type="hidden" name="companyId" value={session.companyId ?? ""} />
              <input type="hidden" name="parentId" value={parent.id} />
              <Plus className="size-4 text-slate-400" />
              <Input name="name" placeholder="Nueva subcategoría" className="h-8" />
              <Button type="submit" variant="outline" className="h-8">Agregar</Button>
            </form>
          </article>
        ))}
      </div>
    </section>
  );
}
