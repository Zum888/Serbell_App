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
  const tree = await listCategoryTree(db(), session.actor, session.companyId);
  return (
    <section className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Categorías</h1>
        <p className="text-sm text-slate-500">Las subcategorías dependen de una categoría de esta empresa. Cambiar un nombre no reescribe el historial.</p>
      </div>
      {params.error ? <StateView variant="error" title={params.error} testId="server-error" /> : null}
      {tree.length === 0 ? <StateView variant="empty" title="Esta empresa no tiene categorías." /> : null}
      <div className="grid gap-3 lg:grid-cols-2">
        {tree.map((parent) => (
          <article key={parent.id} className="rounded-2xl border border-border bg-white p-4">
            <form action={`/api/categories/${parent.id}`} method="post" className="flex gap-2">
              <Input name="name" defaultValue={parent.name} aria-label={`Nombre de ${parent.name}`} />
              <Button type="submit" variant="outline">Renombrar</Button>
            </form>
            <ul className="mt-3 space-y-2">
              {parent.children.map((child) => (
                <li key={child.id}>
                  <form action={`/api/categories/${child.id}`} method="post" className="flex gap-2">
                    <Input name="name" defaultValue={child.name} aria-label={`Nombre de ${child.name}`} />
                    <Button type="submit" variant="outline">Renombrar</Button>
                  </form>
                </li>
              ))}
            </ul>
            <form action="/api/categories" method="post" className="mt-3 flex gap-2">
              <input type="hidden" name="companyId" value={session.companyId ?? ""} />
              <input type="hidden" name="parentId" value={parent.id} />
              <Input name="name" placeholder="Nueva subcategoría" />
              <Button type="submit">Agregar</Button>
            </form>
          </article>
        ))}
      </div>
      <form action="/api/categories" method="post" className="flex max-w-md gap-2">
        <input type="hidden" name="companyId" value={session.companyId} />
        <Input name="name" placeholder="Nueva categoría" />
        <Button type="submit" variant="outline">Agregar categoría</Button>
      </form>
    </section>
  );
}
