import { redirect } from "next/navigation";
import { accessConfigured, accessSecretTooWeak, gateEnforced, hasAccess } from "@/server/access";
import { safeNext } from "@/lib/utils";

export const metadata = {
  title: "Acceso · Serbell",
};

export default async function AccessPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const params = await searchParams;
  const next = safeNext(params.next ?? null, "/");

  if (!gateEnforced() || (await hasAccess())) {
    redirect(next);
  }

  const configured = accessConfigured();
  const failed = params.error === "1";
  const locked = params.error === "2";

  return (
    <main className="flex min-h-full items-center justify-center bg-neutral-50 p-6">
      <div className="w-full max-w-sm rounded-2xl border border-neutral-200 bg-white p-8 shadow-sm">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-neutral-900 text-lg font-semibold text-white">
            S
          </div>
          <h1 className="text-lg font-semibold text-neutral-900">Laboratorio Serbell</h1>
          <p className="mt-1 text-sm text-neutral-500">Escribe la contraseña para entrar.</p>
        </div>

        {accessSecretTooWeak() ? (
          <p className="rounded-lg bg-amber-50 px-3 py-3 text-center text-sm text-amber-800">
            La contraseña configurada es demasiado fácil. Usa al menos 12 caracteres variados.
          </p>
        ) : configured ? (
          <form method="POST" action="/api/acceso" className="space-y-4">
            <input type="hidden" name="next" value={next} />
            <div>
              <label htmlFor="password" className="sr-only">
                Contraseña
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoFocus
                autoComplete="current-password"
                placeholder="Contraseña"
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm text-neutral-900 outline-none focus:border-neutral-900 focus:ring-2 focus:ring-neutral-900/10"
              />
            </div>
            {locked ? (
              <p className="text-sm text-red-600">Demasiados intentos. Espera quince minutos.</p>
            ) : null}
            {failed && !locked ? (
              <p className="text-sm text-red-600">Contraseña incorrecta. Intenta de nuevo.</p>
            ) : null}
            <button
              type="submit"
              className="w-full rounded-lg bg-neutral-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-neutral-800"
            >
              Entrar
            </button>
          </form>
        ) : (
          <p className="rounded-lg bg-amber-50 px-3 py-3 text-center text-sm text-amber-800">
            El acceso aún no está configurado. El administrador debe definir la contraseña en los
            ajustes de la aplicación.
          </p>
        )}
      </div>
    </main>
  );
}
