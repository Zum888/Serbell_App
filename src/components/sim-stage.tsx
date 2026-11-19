"use client";

import { Bell, FileText, Sparkles } from "lucide-react";
import { money, type Scene } from "@/sim/model";

export function SimStage({
  scene,
  compose,
  mark,
  onChoice,
  onField,
}: {
  scene: Scene;
  compose: string;
  mark: string | null;
  onChoice: (id: string) => void;
  onField: (key: keyof Scene["fields"], value: string) => void;
}) {
  return (
    <div data-sim-root className="min-h-full bg-background p-4 pb-28">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs text-slate-500">Demostración · Rivera Construction</p>
          <h1 className="text-lg font-semibold">{scene.person === "carlos" ? "Carlos Ruiz · Contador" : "Luis Rivera · Propietario"}</h1>
        </div>
        <div className="relative">
          <button type="button" data-sim="bell" className="grid size-10 place-items-center rounded-full border border-border bg-white text-slate-600">
            <Bell className="size-4" />
            {scene.notifications.length > 0 && !scene.noticeOpen ? (
              <span className="absolute -right-1 -top-1 grid size-5 place-items-center rounded-full bg-rose-500 text-[10px] text-white">{scene.notifications.length}</span>
            ) : null}
          </button>
          {scene.noticeOpen ? (
            <div className="absolute right-0 z-10 mt-2 w-72 rounded-2xl border border-border bg-white p-3 shadow-sm">
              {scene.notifications.map((item) => (
                <p key={item.id} className="text-sm">
                  <span className="block font-medium">{item.title}</span>
                  <span className="text-slate-500">{item.body}</span>
                </p>
              ))}
            </div>
          ) : null}
        </div>
      </header>
      {scene.banner ? <p className="mb-4 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{scene.banner}</p> : null}
      {scene.route === "inicio" ? <Home scene={scene} compose={compose} mark={mark} onChoice={onChoice} onField={onField} /> : null}
      {scene.route === "comprobantes" ? <Vault scene={scene} mark={mark} /> : null}
      {scene.route === "movimientos" ? <Moves scene={scene} mark={mark} onChoice={onChoice} /> : null}
      {scene.route === "conciliacion" ? <Match scene={scene} mark={mark} /> : null}
      {scene.route === "firma" ? <Firm scene={scene} mark={mark} /> : null}
      {scene.route === "cobrar" ? <Invoices title="Cuentas por cobrar" rows={scene.ar} mark={mark} onChoice={onChoice} card={scene.card} /> : null}
      {scene.route === "pagar" ? <Pay scene={scene} mark={mark} onChoice={onChoice} /> : null}
      {scene.route === "reportes" ? <Bridge scene={scene} mark={mark} /> : null}
      {scene.route === "liquidez" ? <Cash scene={scene} mark={mark} /> : null}
      {scene.route === "proyectos" ? <Projects scene={scene} mark={mark} /> : null}
    </div>
  );
}

function Home({
  scene,
  compose,
  mark,
  onChoice,
  onField,
}: {
  scene: Scene;
  compose: string;
  mark: string | null;
  onChoice: (id: string) => void;
  onField: (key: keyof Scene["fields"], value: string) => void;
}) {
  return (
    <section className="mx-auto flex min-h-[560px] max-w-3xl flex-col rounded-3xl border border-border bg-white">
      <header className="flex items-center gap-3 border-b border-border px-5 py-4">
        <span className="grid size-9 place-items-center rounded-full bg-slate-950 text-white"><Sparkles className="size-4" /></span>
        <div>
          <p className="text-sm font-semibold">Serbell</p>
          <p className="text-xs text-slate-500">Rivera Construction</p>
        </div>
      </header>
      <div className="flex-1 space-y-3 px-5 py-6">
        {scene.messages.length === 0 && !scene.preview ? (
          <div className="py-10 text-center">
            <h2 className="text-3xl font-semibold tracking-tight">Buenos días, <span className="text-primary">Luis.</span></h2>
            <p className="mt-2 text-sm text-slate-500">Esta escena no toca los datos guardados de la empresa.</p>
          </div>
        ) : null}
        {scene.messages.map((message) => (
          <article key={message.id} className={message.role === "user" ? "ml-auto max-w-[85%] rounded-2xl bg-slate-950 px-4 py-3 text-sm text-white" : "max-w-[85%] rounded-2xl bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-700"}>
            {message.body}
          </article>
        ))}
        {scene.processing ? <p className="text-sm text-slate-500">{scene.processing}</p> : null}
        {scene.preview || scene.card || scene.editing ? <Receipt scene={scene} mark={mark} onChoice={onChoice} onField={onField} /> : null}
        {scene.fileReady ? (
          <div data-sim="file-chip" className={`inline-flex items-center gap-2 rounded-2xl border border-border bg-white px-3 py-2 text-sm shadow-sm ${ring(mark === "file-chip")}`}>
            <FileText className="size-4 text-primary" /> {scene.fileLabel}
          </div>
        ) : null}
      </div>
      <div data-sim="chat-drop" className={`border-t border-border px-4 py-4 ${scene.dragOver || mark === "chat-drop" ? "bg-violet-50" : ""} ${ring(mark === "chat-drop")}`}>
        <div className="flex items-center gap-2 rounded-full border border-border px-3 py-2">
          <Sparkles className="size-4 text-primary" />
          <input data-sim="composer" value={compose} readOnly placeholder="Pregúntame sobre tu empresa..." aria-label="Mensaje para Serbell" className="h-9 min-w-0 flex-1 bg-transparent text-sm outline-none" />
        </div>
      </div>
    </section>
  );
}

function Receipt({
  scene,
  mark,
  onChoice,
  onField,
}: {
  scene: Scene;
  mark: string | null;
  onChoice: (id: string) => void;
  onField: (key: keyof Scene["fields"], value: string) => void;
}) {
  const rows = scene.card?.rows ?? [
    ["Proveedor", scene.fields.merchant],
    ["Fecha", scene.fields.date],
    ["Subtotal", `USD ${scene.fields.subtotal}`],
    ["Impuestos", `USD ${scene.fields.tax}`],
    ["Total", `USD ${scene.fields.total}`],
    ["Categoría sugerida", scene.fields.category],
  ];
  const showSlip = scene.fileLabel.includes("HomeDepot") && (scene.preview || scene.editing || (scene.card?.title ?? "HomeDepot").includes("HomeDepot"));
  return (
    <div data-sim="receipt-card" className={`max-w-md rounded-2xl border border-border bg-white p-4 ${ring(mark === "receipt-card")}`}>
      <p className="text-xs text-slate-500">{scene.card?.title ?? "HomeDepot_Receipt.jpg"}</p>
      <div className={`mt-3 grid gap-3 ${showSlip ? "grid-cols-[88px_minmax(0,1fr)]" : ""}`}>
        {showSlip ? (
          <div className="rounded-xl bg-slate-50 p-2 text-[10px] leading-4 text-slate-500">
            <p className="font-semibold text-slate-700">HOME DEPOT</p>
            <p>18 nov 2026</p>
            <p className="mt-2">Materiales</p>
            <p>USD {scene.fields.subtotal}</p>
            <p>Tax {scene.fields.tax}</p>
            <p className="mt-2 font-semibold text-slate-800">USD {scene.fields.total}</p>
          </div>
        ) : null}
        <div>
          {scene.editing ? (
            <div className="space-y-2">
              {(Object.keys(scene.fields) as (keyof Scene["fields"])[]).map((key) => (
                <label key={key} className="block text-xs text-slate-500">
                  {key}
                  <input value={scene.fields[key]} onChange={(event) => onField(key, event.target.value)} className="mt-1 w-full rounded-lg border border-border px-2 py-1 text-sm text-slate-800" />
                </label>
              ))}
              <button type="button" data-sim="choice-edited" onClick={() => onChoice("edited")} className="rounded-full bg-slate-950 px-3 py-1.5 text-xs font-medium text-white">Confirmar</button>
            </div>
          ) : (
            <dl className="space-y-1 text-sm">
              {rows.map(([label, value]) => (
                <div key={label} className="flex justify-between gap-3">
                  <dt className="text-slate-500">{label}</dt>
                  <dd className="text-right font-medium">{value}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      </div>
      {scene.card && !scene.editing ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {scene.card.actions.map((action) => (
            <button key={action.id} type="button" data-sim={`choice-${action.id}`} onClick={() => onChoice(action.id)} className="rounded-full border border-border px-3 py-1.5 text-xs font-medium hover:border-slate-400">
              {action.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function Vault({ scene, mark }: { scene: Scene; mark: string | null }) {
  return (
    <section>
      <h2 className="text-2xl font-semibold">Comprobantes</h2>
      <p className="mt-1 text-sm text-slate-500">La biblioteca de esta demostración. No se sube ningún archivo.</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {scene.documents.map((doc) => (
          <article key={doc.id} data-sim="vault-card" className={`rounded-2xl border border-border bg-white p-4 ${ring(mark === "vault-card")}`}>
            <div className="mb-3 rounded-xl bg-slate-50 p-3 text-xs text-slate-500">
              <p className="font-semibold text-slate-700">{doc.merchant}</p>
              <p>{doc.fileName}</p>
            </div>
            <p className="font-semibold">{doc.amount}</p>
            <p className="text-xs text-slate-500">{doc.date}</p>
            <p className="mt-2 text-xs font-medium text-slate-700">{doc.status}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function Moves({ scene, mark, onChoice }: { scene: Scene; mark: string | null; onChoice: (id: string) => void }) {
  const twins = scene.movements.filter((move) => move.spotlight);
  return (
    <section>
      <h2 className="text-2xl font-semibold">Movimientos</h2>
      {twins.length > 1 ? (
        <div data-sim="dup-table" className={`mt-4 grid gap-3 md:grid-cols-2 ${ring(mark === "dup-table")}`}>
          {twins.map((move) => (
            <article key={move.id} className="rounded-2xl border border-border bg-white p-4">
              <p className="font-semibold">{move.merchant}</p>
              <p className="text-sm text-slate-500">{move.date} · {move.description}</p>
              <p className="mt-2 text-lg font-semibold">{money(move.amountCents)}</p>
            </article>
          ))}
        </div>
      ) : null}
      <Table scene={scene} mark={mark} />
      {scene.card ? <div className="mt-4"><Actions card={scene.card} onChoice={onChoice} /></div> : null}
      {scene.duplicateNote ? <p className="mt-3 text-sm text-slate-600">{scene.duplicateNote}</p> : null}
    </section>
  );
}

function Match({ scene, mark }: { scene: Scene; mark: string | null }) {
  const doc = scene.documents[0];
  const hit = scene.movements.find((move) => move.spotlight);
  return (
    <section>
      <h2 className="text-2xl font-semibold">Conciliación</h2>
      <p className="mt-1 text-sm text-slate-500">Serbell compara fecha, importe, proveedor y la descripción del banco.</p>
      <div className="mt-4 grid items-start gap-4 lg:grid-cols-2">
        <article className="rounded-2xl border border-border bg-white p-4">
          <p className="text-xs text-slate-500">Comprobante</p>
          <p className="mt-2 font-semibold">{doc?.merchant ?? scene.fields.merchant}</p>
          <p className="text-sm text-slate-500">{doc?.date ?? scene.fields.date}</p>
          <p className="mt-2 text-lg font-semibold">{doc?.amount ?? `USD ${scene.fields.total}`}</p>
        </article>
        <article data-sim="link-pair" className={`rounded-2xl border border-border bg-white p-4 ${ring(Boolean(scene.linked) || mark === "link-pair")}`}>
          <p className="text-xs text-slate-500">Movimiento</p>
          <p className="mt-2 font-semibold">{hit?.merchant}</p>
          <p className="text-sm text-slate-500">{hit?.account} · {hit?.date}</p>
          <p className="text-sm text-slate-500">{hit?.description}</p>
          <p className="mt-2 text-lg font-semibold">{hit ? money(hit.amountCents) : ""}</p>
          {scene.linked ? <p className="mt-2 text-sm text-emerald-700">{hit?.review}</p> : null}
        </article>
      </div>
      <Table scene={scene} mark={mark} />
    </section>
  );
}

function Firm({ scene, mark }: { scene: Scene; mark: string | null }) {
  const open = scene.firm.find((row) => row.id === scene.firmOpen);
  return (
    <section>
      <h2 className="text-2xl font-semibold">Cierre del despacho</h2>
      <p className="mt-1 text-sm text-slate-500">Carlos revisa excepciones. El periodo no se cierra solo.</p>
      {scene.firm.length > 0 ? (
        <div className="mt-4 space-y-2">
          {scene.firm.map((row) => (
            <article key={row.id} data-sim={row.id === "rivera" ? "firm-rivera" : "firm-row"} className={`rounded-2xl border border-border bg-white p-4 ${ring(mark === "firm-rivera" || mark === "firm-row")}`}>
              <div className="flex items-center justify-between gap-3">
                <p className="font-semibold">{row.name}</p>
                <p className="text-xs text-slate-500">{row.priority} · {row.progress}%</p>
              </div>
              <p className="mt-1 text-sm text-slate-600">{row.exceptions.length === 0 ? "Sin excepciones." : row.exceptions.join(" · ")}</p>
            </article>
          ))}
        </div>
      ) : null}
      {open ? (
        <div className="mt-4 rounded-2xl border border-border bg-white p-4">
          <p className="font-semibold">{open.name}</p>
          {open.exceptions.length === 0 ? <p className="mt-2 text-sm text-emerald-700">Listo para tu cierre. Todavía no está cerrado.</p> : <p className="mt-2 text-sm">{open.exceptions[0]}</p>}
          <button type="button" data-sim="resolve" className={`mt-3 rounded-full bg-slate-950 px-3 py-1.5 text-xs font-medium text-white ${ring(mark === "resolve")}`}>Resolver</button>
        </div>
      ) : null}
      {scene.documents.length > 0 && scene.firm.length === 0 ? (
        <div data-sim="firm-row" className="mt-4 space-y-2">
          {scene.documents.map((doc) => (
            <article key={doc.id} className="rounded-2xl border border-border bg-white p-4">
              <p className="font-semibold">{doc.merchant}</p>
              <p className="text-sm text-slate-500">{doc.amount} · {doc.status}</p>
            </article>
          ))}
          <button type="button" data-sim="approve" className={`rounded-full bg-slate-950 px-3 py-1.5 text-xs font-medium text-white ${ring(mark === "approve")}`}>Aprobar</button>
        </div>
      ) : null}
    </section>
  );
}

function Invoices({
  title,
  rows,
  mark,
  onChoice,
  card,
}: {
  title: string;
  rows: Scene["ar"];
  mark: string | null;
  onChoice: (id: string) => void;
  card: Scene["card"];
}) {
  return (
    <section>
      <h2 className="text-2xl font-semibold">{title}</h2>
      <div className="mt-4 space-y-2">
        {rows.map((row) => (
          <article key={row.id} data-sim={row.id} className={`rounded-2xl border border-border bg-white p-4 ${ring(mark === row.id)}`}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold">{row.party}</p>
                <p className="text-sm text-slate-500">{row.number} · vence {row.due}</p>
                <p className="mt-1 text-sm text-slate-600">{row.note}</p>
              </div>
              <div className="text-right">
                <p className="font-semibold">{money(row.amountCents)}</p>
                <p className="text-xs text-slate-500">{row.status}</p>
              </div>
            </div>
          </article>
        ))}
      </div>
      {card ? <div className="mt-4"><Actions card={card} onChoice={onChoice} /></div> : null}
    </section>
  );
}

function Pay({ scene, mark, onChoice }: { scene: Scene; mark: string | null; onChoice: (id: string) => void }) {
  return (
    <section>
      <Invoices title="Cuentas por pagar" rows={scene.ap} mark={mark} onChoice={onChoice} card={scene.card} />
      {scene.reminder ? <p className="mt-3 text-sm text-slate-600">{scene.reminder}</p> : null}
      {scene.simulatedPayment ? <p className="mt-2 text-sm text-amber-700">Simulación: el pago no sale del banco.</p> : null}
    </section>
  );
}

function Bridge({ scene, mark }: { scene: Scene; mark: string | null }) {
  return (
    <section data-sim="bridge">
      <h2 className="text-2xl font-semibold">Utilidad y efectivo</h2>
      <div className="mt-4 space-y-2">
        {scene.bridge?.map((line) => (
          <article key={line.id} data-sim={`bridge-${line.id}`} className={`rounded-2xl border border-border bg-white p-4 ${ring(mark === `bridge-${line.id}` || scene.bridgeOpen === line.id)}`}>
            <div className="flex items-center justify-between gap-3">
              <p className="font-medium">{line.label}</p>
              <p className="font-semibold tabular-nums">{line.cents < 0 ? `− ${money(Math.abs(line.cents))}` : money(line.cents)}</p>
            </div>
            <p className="mt-1 text-sm text-slate-500">{line.note}</p>
            {scene.bridgeOpen === line.id ? (
              <ul className="mt-2 text-sm text-slate-700">
                {line.records.map((record) => <li key={record}>{record}</li>)}
              </ul>
            ) : null}
          </article>
        ))}
      </div>
      {scene.suggestion ? <p className="mt-4 text-sm text-slate-700">{scene.suggestion}</p> : null}
    </section>
  );
}

function Cash({ scene, mark }: { scene: Scene; mark: string | null }) {
  const rows = scene.cash ?? [];
  const max = Math.max(...rows.map((row) => Math.abs(row.cents)), 1);
  return (
    <section>
      <h2 className="text-2xl font-semibold">Efectivo de los próximos siete días</h2>
      <p className="mt-1 text-sm text-slate-500">{scene.cashNote}</p>
      <div data-sim="cash-chart" className={`mt-4 flex h-48 items-end gap-3 rounded-2xl border border-border bg-white p-4 ${ring(mark === "cash-chart")}`}>
        {rows.map((row) => (
          <div key={row.day} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
            <div className="w-full rounded-t-md" style={{ height: `${Math.max(8, (Math.abs(row.cents) / max) * 100)}%`, background: row.cents < 0 ? "#fb7185" : "#6d5efc" }} />
            <span className="text-[10px] text-slate-400">{row.day.split(" ")[0]}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function Projects({ scene, mark }: { scene: Scene; mark: string | null }) {
  return (
    <section data-sim="projects">
      <h2 className="text-2xl font-semibold">Rentabilidad por obra</h2>
      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        {scene.projects.map((project) => {
          const margin = project.income - project.cost;
          const open = scene.openProject === project.id;
          return (
            <article key={project.id} data-sim={`project-${project.id}`} className={`rounded-2xl border border-border bg-white p-4 ${ring(mark === `project-${project.id}` || open)}`}>
              <p className="font-semibold">{project.name}</p>
              <p className="mt-2 text-sm text-slate-500">Ingresos {money(project.income)}</p>
              <p className="text-sm text-slate-500">Costos {money(project.cost)}</p>
              <p className={`mt-2 font-semibold ${margin < 0 ? "text-rose-600" : "text-emerald-700"}`}>{money(margin)}</p>
              {open ? <ul className="mt-3 space-y-1 text-sm text-slate-600">{project.lines.map((line) => <li key={line}>{line}</li>)}</ul> : null}
            </article>
          );
        })}
      </div>
      {scene.suggestion ? <p className="mt-4 text-sm text-slate-700">{scene.suggestion}</p> : null}
    </section>
  );
}

function Table({ scene, mark }: { scene: Scene; mark: string | null }) {
  return (
    <div className="mt-4 overflow-hidden rounded-2xl border border-border bg-white">
      <table className="w-full text-left text-sm">
        <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-2 font-medium">Movimiento</th>
            <th className="px-4 py-2 font-medium">Fecha</th>
            <th className="px-4 py-2 text-right font-medium">Importe</th>
            <th className="px-4 py-2 font-medium">Estado</th>
          </tr>
        </thead>
        <tbody>
          {scene.movements.map((move) => (
            <tr key={move.id} data-sim={`move-${move.id}`} className={`border-t border-slate-100 ${move.spotlight || mark === `move-${move.id}` ? "bg-violet-50" : ""}`}>
              <td className="px-4 py-3">
                <span className="block font-medium">{move.merchant}</span>
                <span className="text-xs text-slate-500">{move.description}{move.category ? ` · ${move.category}` : ""}{move.receipt ? ` · ${move.receipt}` : ""}</span>
              </td>
              <td className="px-4 py-3 text-slate-600">{move.date}</td>
              <td className="px-4 py-3 text-right tabular-nums">{money(move.amountCents)}</td>
              <td className="px-4 py-3 text-slate-600">{move.review}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Actions({ card, onChoice }: { card: NonNullable<Scene["card"]>; onChoice: (id: string) => void }) {
  return (
    <div className="rounded-2xl border border-border bg-white p-4">
      <p className="text-sm font-medium">{card.title}</p>
      <dl className="mt-2 space-y-1 text-sm">
        {card.rows.map(([label, value]) => (
          <div key={label} className="flex justify-between gap-3">
            <dt className="text-slate-500">{label}</dt>
            <dd className="text-right">{value}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-3 flex flex-wrap gap-2">
        {card.actions.map((action) => (
          <button key={action.id} type="button" data-sim={`choice-${action.id}`} onClick={() => onChoice(action.id)} className="rounded-full border border-border px-3 py-1.5 text-xs font-medium hover:border-slate-400">
            {action.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function ring(on: boolean) {
  return on ? "ring-2 ring-primary ring-offset-2" : "";
}
