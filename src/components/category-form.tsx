import { Input } from "@/components/ui/input";

export function pairsToGroups(pairs: { subcategoryId: string; label: string }[]) {
  const groups = new Map<string, { id: string; name: string }[]>();
  for (const pair of pairs) {
    const [category, ...rest] = pair.label.split(" / ");
    const name = rest.join(" / ") || pair.label;
    const list = groups.get(category) ?? [];
    list.push({ id: pair.subcategoryId, name });
    groups.set(category, list);
  }
  return [...groups.entries()].map(([name, children]) => ({ name, children }));
}

export function CategoryForm({
  id,
  subcategoryId,
  categories,
  canReview,
  sealed,
  next,
  testId,
  compact = false,
}: {
  id: string;
  subcategoryId: string;
  categories: { name: string; children: { id: string; name: string }[] }[];
  canReview: boolean;
  sealed: boolean;
  next: string;
  testId: string;
  compact?: boolean;
}) {
  return (
    <form action={`/api/transactions/${id}/classification`} method="post" className={compact ? "mt-1 space-y-1" : "mt-3 space-y-2 rounded-xl border border-border p-3"}>
      <input type="hidden" name="next" value={next} />
      {sealed ? <p className="text-xs text-slate-500">Sellado. El servidor rechaza el cambio.</p> : null}
      {compact ? null : <h3 className="text-sm font-medium">Cambiar categoría y subcategoría</h3>}
      <label className="block text-xs text-slate-500">
        {compact ? null : "Categoría y subcategoría"}
        <select
          name="subcategoryId"
          defaultValue={subcategoryId}
          required
          data-testid={compact ? `category-select-${id}` : `detail-category-select-${id}`}
          aria-label={`Categoría y subcategoría de ${id}`}
          className="mt-1 h-9 w-full min-w-[180px] rounded-xl border border-border bg-white px-2 text-sm"
        >
          <option value="">Elegir</option>
          {categories.map((group) => (
            <optgroup key={group.name} label={group.name}>
              {group.children.map((child) => (
                <option key={child.id} value={child.id}>{child.name}</option>
              ))}
            </optgroup>
          ))}
        </select>
      </label>
      {canReview ? (
        <Input name="justification" required minLength={8} placeholder="Justificación del contador" aria-label="Justificación" />
      ) : (
        <p className="text-xs text-slate-500">{compact ? "Propuesta" : "Queda como propuesta. No sella ni crea el asiento."}</p>
      )}
      <button type="submit" data-testid={testId} className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-white">
        Guardar categoría
      </button>
    </form>
  );
}
