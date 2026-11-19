import {
  BANK,
  BRIDGE,
  CASH_GAP,
  CASH_WITH_COLLECTION,
  JOHNSON,
  PROJECTS,
  cloneScene,
  dollarsToCents,
  emptyScene,
  money,
  say,
  type Scene,
  type SimMove,
} from "@/sim/model";

export type Step = {
  id: string;
  label: string;
  ms: number;
  cursor?: string;
  click?: boolean;
  drag?: boolean;
  compose?: string;
  highlight?: string | null;
  wait?: boolean;
  auto?: string;
  when?: (scene: Scene) => boolean;
  run: (scene: Scene, choice?: string) => Scene;
};

export type Flow = {
  id: string;
  title: string;
  description: string;
  opening: () => Scene;
  steps: Step[];
};

const HD = "hd";

function bankMoves(): SimMove[] {
  return [
    { id: "shell", merchant: "Shell", account: BANK, date: "16 nov 2026", amountCents: -6_480, description: "SHELL OIL 4421", category: "Combustible", subcategory: "Gasolina", receipt: null, review: "Pendiente", spotlight: false },
    { id: "ace", merchant: "Ace Hardware", account: BANK, date: "17 nov 2026", amountCents: -4_599, description: "ACE HARDWARE", category: "Materiales", subcategory: "Ferretería", receipt: null, review: "Pendiente", spotlight: false },
    { id: HD, merchant: "Home Depot", account: BANK, date: "18 nov 2026", amountCents: -48_520, description: "HOME DEPOT #2194", category: "", subcategory: "", receipt: null, review: "Pendiente", spotlight: false },
  ];
}

function spot(scene: Scene, id: string): Scene {
  return { ...scene, highlight: id, movements: scene.movements.map((move) => ({ ...move, spotlight: move.id === id })) };
}

const saved = (scene: Scene) => scene.decision === "confirm" || scene.decision === "edited";

const ticket: Flow = {
  id: "ticket",
  title: "Registrar un gasto y conciliarlo",
  description: "Arrastra un ticket, confírmalo y míralo llegar al banco y al contador.",
  opening: () => ({ ...emptyScene(), movements: bankMoves() }),
  steps: [
    { id: "inicio", label: "Inicio", ms: 700, cursor: "chat-drop", run: (scene) => ({ ...scene, route: "inicio", person: "luis" }) },
    { id: "archivo", label: "Aparece el ticket", ms: 1600, cursor: "file-chip", run: (scene) => ({ ...scene, fileReady: true }) },
    {
      id: "arrastre",
      label: "Arrastrar el ticket",
      ms: 2000,
      drag: true,
      cursor: "chat-drop",
      run: (scene) => ({ ...scene, dragOver: true, preview: true, fileReady: false }),
    },
    {
      id: "escribir",
      label: "Escribir el pedido",
      ms: 1600,
      compose: "Serbell, registra esta compra.",
      cursor: "composer",
      run: (scene) => say(scene, "user", "Serbell, registra esta compra."),
    },
    { id: "leyendo", label: "Leyendo comprobante", ms: 700, run: (scene) => ({ ...scene, processing: "Leyendo comprobante." }) },
    { id: "proveedor", label: "Identificando proveedor", ms: 700, run: (scene) => ({ ...scene, processing: "Identificando proveedor." }) },
    { id: "conceptos", label: "Extrayendo conceptos", ms: 700, run: (scene) => ({ ...scene, processing: "Extrayendo conceptos." }) },
    { id: "importes", label: "Verificando importes", ms: 700, run: (scene) => ({ ...scene, processing: "Verificando importes." }) },
    {
      id: "datos",
      label: "Datos del ticket",
      ms: 900,
      cursor: "receipt-card",
      run: (scene) => ({
        ...say(scene, "assistant", "He leído tu comprobante. Estos son los datos que encontré."),
        card: {
          title: "HomeDepot_Receipt.jpg",
          rows: [
            ["Proveedor", scene.fields.merchant],
            ["Fecha", scene.fields.date],
            ["Subtotal", `USD ${scene.fields.subtotal}`],
            ["Impuestos", `USD ${scene.fields.tax}`],
            ["Total", `USD ${scene.fields.total}`],
            ["Categoría sugerida", scene.fields.category],
          ],
          actions: [
            { id: "confirm", label: "Confirmar" },
            { id: "edit", label: "Editar información" },
            { id: "reject", label: "Rechazar" },
          ],
        },
      }),
    },
    {
      id: "elegir",
      label: "Confirmar, editar o rechazar",
      ms: 900,
      wait: true,
      auto: "confirm",
      cursor: "choice-confirm",
      click: true,
      run: (scene, choice) => {
        if (choice === "edit") {
          return { ...say(scene, "assistant", "Corrige lo que haga falta y confirma otra vez."), decision: "edit", editing: true, card: scene.card ? { ...scene.card, actions: [] } : null };
        }
        if (choice === "reject") {
          return {
            ...say(scene, "assistant", "¿Qué información es incorrecta?"),
            decision: "reject",
            card: {
              title: "Qué corregir",
              rows: [],
              actions: [
                { id: "proveedor", label: "El proveedor" },
                { id: "importe", label: "El importe" },
                { id: "fecha", label: "La fecha" },
              ],
            },
          };
        }
        return { ...scene, decision: "confirm", card: null, editing: false };
      },
    },
    {
      id: "editar",
      label: "Editar datos",
      ms: 900,
      wait: true,
      auto: "edited",
      cursor: "choice-edited",
      when: (scene) => scene.decision === "edit",
      run: (scene) => ({ ...scene, decision: "edited", editing: false, card: null }),
    },
    {
      id: "rechazo",
      label: "Decir qué está mal",
      ms: 900,
      wait: true,
      auto: "importe",
      cursor: "choice-importe",
      when: (scene) => scene.decision === "reject",
      run: (scene, choice) => ({ ...scene, decision: `wrong-${choice ?? "importe"}`, card: null }),
    },
    {
      id: "rechazado",
      label: "No se guardó",
      ms: 1400,
      when: (scene) => Boolean(scene.decision?.startsWith("wrong")),
      run: (scene) => say(scene, "assistant", "No guardé el comprobante. Cuando tengas el dato correcto, arrástralo de nuevo."),
    },
    {
      id: "guardar",
      label: "Guardar en comprobantes",
      ms: 1400,
      when: saved,
      run: (scene) => {
        const cents = dollarsToCents(scene.fields.total) ?? 48_520;
        const doc = {
          id: "doc-hd",
          fileName: "HomeDepot_Receipt.jpg",
          merchant: scene.fields.merchant,
          amount: money(cents),
          date: scene.fields.date,
          status: "Guardado",
        };
        return {
          ...say(scene, "assistant", "Listo, guardé tu comprobante y ahora buscaré el movimiento bancario correspondiente."),
          preview: false,
          documents: [doc],
        };
      },
    },
    { id: "vault", label: "Abrir comprobantes", ms: 1100, cursor: "nav-comprobantes", click: true, when: saved, run: (scene) => ({ ...scene, route: "comprobantes" }) },
    { id: "mira-shell", label: "Revisar movimientos", ms: 600, cursor: "move-shell", when: saved, run: (scene) => ({ ...spot(scene, "shell"), route: "conciliacion" }) },
    { id: "mira-ace", label: "Comparar otro movimiento", ms: 600, cursor: "move-ace", when: saved, run: (scene) => spot(scene, "ace") },
    { id: "mira-hd", label: "Encontrar Home Depot", ms: 900, cursor: "move-hd", when: saved, run: (scene) => spot(scene, HD) },
    {
      id: "coincide",
      label: "Mostrar la coincidencia",
      ms: 1400,
      when: saved,
      run: (scene) => say(scene, "assistant", "Encontré un movimiento que coincide con tu comprobante."),
    },
    {
      id: "vincular",
      label: "Vincular ticket y banco",
      ms: 1200,
      cursor: "link-pair",
      when: saved,
      run: (scene) => {
        const cents = dollarsToCents(scene.fields.total) ?? 48_520;
        const same = cents === 48_520;
        return {
          ...say(scene, "assistant", same
            ? "Vinculé el comprobante con el movimiento de Chase. No creé otro gasto."
            : "Vinculé el comprobante con el movimiento que ya estaba en Chase. El banco sigue en USD 485.20 y no creé otro gasto."),
          linked: true,
          movements: scene.movements.map((move) => move.id === HD
            ? { ...move, category: scene.fields.category, subcategory: "Obra", receipt: "HomeDepot_Receipt.jpg", review: "Pendiente de revisión contable", spotlight: true }
            : move),
          documents: scene.documents.map((doc) => ({ ...doc, status: "Comprobante conciliado · Pendiente de revisión contable" })),
        };
      },
    },
    { id: "contador", label: "Vista del contador", ms: 1000, cursor: "firm-row", when: saved, run: (scene) => ({ ...scene, route: "firma", person: "carlos" }) },
    {
      id: "aprobar",
      label: "El contador aprueba",
      ms: 1200,
      cursor: "approve",
      click: true,
      when: saved,
      run: (scene) => ({
        ...say(scene, "assistant", "Carlos revisó el ticket, la categoría y el movimiento. Quedó revisado."),
        movements: scene.movements.map((move) => move.id === HD ? { ...move, review: "Revisado" } : move),
        documents: scene.documents.map((doc) => ({ ...doc, status: "Revisado" })),
      }),
    },
    {
      id: "cierre",
      label: "De vuelta al inicio",
      ms: 1600,
      when: saved,
      run: (scene) => ({
        ...say({ ...scene, route: "inicio", person: "luis" }, "assistant", `Tu compra de ${scene.fields.merchant} quedó registrada, vinculada con el banco y revisada por tu contador. No necesitas hacer nada más.`),
        banner: "Compra registrada, vinculada y revisada.",
      }),
    },
  ],
};

const duplicados: Flow = {
  id: "duplicados",
  title: "Detectar gastos duplicados y fugas de dinero",
  description: "Serbell señala dos cargos parecidos y tú decides, sin borrar nada.",
  opening: () => ({
    ...emptyScene(),
    movements: [
      { id: "d1", merchant: "Home Depot", account: BANK, date: "12 nov 2026", amountCents: -28_500, description: "HOME DEPOT #2194", category: "Materiales", subcategory: "Obra", receipt: null, review: "Pendiente", spotlight: true },
      { id: "d2", merchant: "The Home Depot", account: BANK, date: "13 nov 2026", amountCents: -28_500, description: "HOME DEPOT #2194", category: "Materiales", subcategory: "Obra", receipt: null, review: "Pendiente", spotlight: true },
    ],
  }),
  steps: [
    {
      id: "aviso",
      label: "Serbell avisa",
      ms: 1400,
      run: (scene) => say(scene, "assistant", "He detectado dos cargos similares que podrían representar un gasto duplicado."),
    },
    { id: "abrir", label: "Abrir los movimientos", ms: 1000, cursor: "dup-table", run: (scene) => ({ ...scene, route: "movimientos" }) },
    {
      id: "elegir",
      label: "Decidir qué hacer",
      ms: 900,
      wait: true,
      auto: "investigar",
      cursor: "choice-investigar",
      run: (scene, choice) => {
        const picked = choice ?? "investigar";
        const note = picked === "distintos"
          ? "Quedaron como compras distintas."
          : picked === "reclamo"
            ? "Preparé la reclamación. Los dos cargos siguen en el banco."
            : "Marqué el cargo para investigación. No eliminé ningún movimiento.";
        return {
          ...say({ ...scene, decision: picked, duplicateNote: note, route: "inicio" }, "assistant", note),
          movements: scene.movements.map((move) => ({ ...move, review: note })),
        };
      },
    },
  ],
};

duplicados.steps.splice(2, 0, {
  id: "opciones",
  label: "Opciones",
  ms: 800,
  run: (scene) => ({
    ...scene,
    card: {
      title: "USD 285.00 en dos días",
      rows: [["12 nov", "Home Depot · HOME DEPOT #2194"], ["13 nov", "The Home Depot · HOME DEPOT #2194"]],
      actions: [
        { id: "distintos", label: "Son compras distintas" },
        { id: "investigar", label: "Marcar para investigación" },
        { id: "reclamo", label: "Preparar una reclamación" },
      ],
    },
  }),
});

const faltantes: Flow = {
  id: "faltantes",
  title: "Solicitar comprobantes faltantes",
  description: "Tres movimientos sin ticket. Arrastras los comprobantes y el contador los recibe listos.",
  opening: () => ({
    ...emptyScene(),
    movements: [
      { id: "shell", merchant: "Shell", account: BANK, date: "16 nov 2026", amountCents: -6_480, description: "SHELL OIL 4421", category: "Combustible", subcategory: "Gasolina", receipt: null, review: "Sin comprobante", spotlight: true },
      { id: "ace", merchant: "Ace Hardware", account: BANK, date: "17 nov 2026", amountCents: -4_599, description: "ACE HARDWARE", category: "Materiales", subcategory: "Ferretería", receipt: null, review: "Sin comprobante", spotlight: true },
      { id: "lima", merchant: "Ferretería Lima", account: BANK, date: "18 nov 2026", amountCents: -22_000, description: "FERRETERIA LIMA", category: "Materiales", subcategory: "Obra", receipt: null, review: "Sin comprobante", spotlight: true },
    ],
    notifications: [{ id: "n1", title: "Faltan 3 comprobantes", body: "Shell, Ace Hardware y Ferretería Lima no tienen ticket." }],
  }),
  steps: [
    { id: "aviso", label: "Notificación", ms: 900, cursor: "bell", run: (scene) => scene },
    { id: "abrir", label: "Abrir el aviso", ms: 900, cursor: "bell", click: true, run: (scene) => ({ ...scene, noticeOpen: true, route: "movimientos" }) },
    { id: "traer", label: "Tomar los tres tickets", ms: 900, cursor: "file-chip", run: (scene) => ({ ...scene, route: "inicio", fileReady: true, fileLabel: "Shell, Ace y Lima" }) },
    {
      id: "adjuntar",
      label: "Adjuntar tickets",
      ms: 2000,
      drag: true,
      cursor: "chat-drop",
      run: (scene) => ({
        ...say({ ...scene, route: "inicio", preview: true, noticeOpen: false }, "assistant", "Leí los tres tickets y coinciden con Shell, Ace Hardware y Ferretería Lima."),
        documents: scene.movements.map((move) => ({
          id: `doc-${move.id}`,
          fileName: `${move.merchant.replaceAll(" ", "")}_Receipt.jpg`,
          merchant: move.merchant,
          amount: money(Math.abs(move.amountCents)),
          date: move.date,
          status: "Listo para el contador",
        })),
        movements: scene.movements.map((move) => ({ ...move, receipt: `${move.merchant.replaceAll(" ", "")}_Receipt.jpg`, review: "Listo para revisión" })),
      }),
    },
    { id: "contador", label: "Llegan al contador", ms: 1200, cursor: "firm-row", run: (scene) => ({ ...scene, route: "firma", person: "carlos", banner: "Quedan 0 comprobantes pendientes." }) },
  ],
};

const utilidad: Flow = {
  id: "utilidad",
  title: "Explicar la diferencia entre utilidad y efectivo",
  description: "Por qué el mes deja utilidad y el banco no sube lo mismo.",
  opening: () => emptyScene(),
  steps: [
    {
      id: "pregunta",
      label: "La pregunta",
      ms: 1400,
      compose: "¿Por qué tengo utilidades, pero no tengo dinero en el banco?",
      cursor: "composer",
      run: (scene) => say(scene, "user", "¿Por qué tengo utilidades, pero no tengo dinero en el banco?"),
    },
    {
      id: "puente",
      label: "El puente",
      ms: 1400,
      cursor: "bridge",
      run: (scene) => ({
        ...say(scene, "assistant", "La utilidad del mes es USD 12,400.00. El efectivo del periodo bajó USD 4,800.00. Estas son las piezas."),
        route: "reportes",
        bridge: BRIDGE.map((line) => ({ ...line, records: [...line.records] })),
      }),
    },
    { id: "abrir", label: "Ver las ventas por cobrar", ms: 1100, cursor: "bridge-cobrar", click: true, run: (scene) => ({ ...scene, bridgeOpen: "cobrar" }) },
    {
      id: "accion",
      label: "Acción recomendada",
      ms: 1400,
      run: (scene) => ({
        ...say(scene, "assistant", "Cobra la factura de Johnson Construction, USD 2,800.00, antes del viernes. Es la pieza que puedes convertir en efectivo esta semana."),
        suggestion: "Cobrar FAC-880 de Johnson Construction.",
      }),
    },
  ],
};

const liquidez: Flow = {
  id: "liquidez",
  title: "Prevenir problemas de liquidez",
  description: "El viernes el efectivo no alcanza. Serbell propone un recordatorio de cobro.",
  opening: () => ({
    ...emptyScene(),
    ar: [{ ...JOHNSON }],
    notifications: [{ id: "n-cash", title: "Efectivo el viernes", body: "Con los pagos ya previstos, Chase queda en menos USD 500.00 el viernes 20." }],
  }),
  steps: [
    { id: "aviso", label: "Aviso", ms: 900, cursor: "bell", click: true, run: (scene) => ({ ...scene, noticeOpen: true }) },
    {
      id: "grafica",
      label: "Siete días",
      ms: 1400,
      cursor: "cash-chart",
      run: (scene) => ({
        ...say(scene, "assistant", "El viernes 20 el banco quedaría en menos USD 500.00. El jueves sale nómina por USD 900.00 y el viernes Cementos del Valle por USD 3,800.00."),
        route: "liquidez",
        cash: CASH_GAP.map((day) => ({ ...day })),
        cashNote: "Sin el cobro de Johnson.",
        noticeOpen: false,
      }),
    },
    { id: "factura", label: "Factura por cobrar", ms: 1000, cursor: "ar-johnson", run: (scene) => ({ ...scene, route: "cobrar" }) },
    {
      id: "autorizar",
      label: "Autorizar el recordatorio",
      ms: 900,
      wait: true,
      auto: "si",
      cursor: "choice-si",
      run: (scene, choice) => choice === "no"
        ? say({ ...scene, decision: "no" }, "assistant", "Dejo el recordatorio sin enviar.")
        : ({
          ...say({ ...scene, decision: "si", reminder: "Recordatorio listo para Johnson Construction, FAC-880, USD 2,800.00. No se envió solo." }, "assistant", "Dejé el recordatorio en la factura. No salió ningún mensaje real."),
          cash: CASH_WITH_COLLECTION.map((day) => ({ ...day })),
          cashNote: "Si Johnson paga el jueves, el viernes cierra en USD 2,300.00.",
          ar: scene.ar.map((row) => row.id === JOHNSON.id ? { ...row, note: "Recordatorio preparado el 18 nov. Pendiente de tu envío." } : row),
        }),
    },
  ],
};

liquidez.steps.splice(3, 0, {
  id: "pregunta",
  label: "Pedir autorización",
  ms: 800,
  run: (scene) => ({
    ...say(scene, "assistant", "¿Preparo el recordatorio de cobro para Johnson Construction?"),
    card: { title: "FAC-880", rows: [["Importe", "USD 2,800.00"], ["Vence", "20 nov 2026"]], actions: [{ id: "si", label: "Preparar recordatorio" }, { id: "no", label: "Ahora no" }] },
  }),
});

const pagar: Flow = {
  id: "pagar",
  title: "Gestionar cuentas por pagar",
  description: "Una factura de proveedor entra por el chat y queda como pago pendiente.",
  opening: () => emptyScene(),
  steps: [
    { id: "archivo", label: "Factura del proveedor", ms: 1600, cursor: "file-chip", run: (scene) => ({ ...scene, fileReady: true, fileLabel: "CementosDelValle.pdf" }) },
    { id: "arrastre", label: "Arrastrarla al chat", ms: 2000, drag: true, cursor: "chat-drop", run: (scene) => ({ ...scene, preview: true, fileReady: false, dragOver: true }) },
    { id: "leyendo", label: "Leyendo la factura", ms: 700, run: (scene) => ({ ...scene, processing: "Leyendo la factura." }) },
    {
      id: "datos",
      label: "Datos",
      ms: 900,
      run: (scene) => ({
        ...say(scene, "assistant", "He leído la factura de Cementos del Valle."),
        card: {
          title: "CementosDelValle.pdf",
          rows: [["Proveedor", "Cementos del Valle"], ["Fecha", "18 nov 2026"], ["Total", "USD 1,260.00"], ["Vence", "2 dic 2026"]],
          actions: [{ id: "confirm", label: "Confirmar" }, { id: "reject", label: "Rechazar" }],
        },
      }),
    },
    {
      id: "elegir",
      label: "Confirmar",
      ms: 800,
      wait: true,
      auto: "confirm",
      cursor: "choice-confirm",
      run: (scene, choice) => choice === "reject"
        ? say({ ...scene, decision: "reject", card: null, preview: false }, "assistant", "No guardé la factura.")
        : ({ ...scene, decision: "confirm", card: null, preview: false }),
    },
    {
      id: "guardar",
      label: "Guardar y crear la cuenta",
      ms: 1200,
      when: (scene) => scene.decision === "confirm",
      run: (scene) => ({
        ...say(scene, "assistant", "Guardé la factura y creé la cuenta por pagar. El efectivo del viernes está justo: te propongo pagar el 30 de noviembre, no antes."),
        documents: [{ id: "doc-cem", fileName: "CementosDelValle.pdf", merchant: "Cementos del Valle", amount: money(126_000), date: "18 nov 2026", status: "Guardado" }],
        ap: [{ id: "ap-cem", party: "Cementos del Valle", number: "FAC-CV-44", due: "2 dic 2026", amountCents: 126_000, status: "Por vencer", note: "Fecha sugerida de pago: 30 nov 2026." }],
        route: "pagar",
      }),
    },
    {
      id: "programar",
      label: "Programar recordatorio",
      ms: 800,
      wait: true,
      auto: "si",
      cursor: "choice-si",
      when: (scene) => scene.decision === "confirm",
      run: (scene, choice) => choice === "no"
        ? say(scene, "assistant", "La factura queda pendiente, sin recordatorio.")
        : ({
          ...say(scene, "assistant", "Dejé el recordatorio para el 30 de noviembre. El pago del banco es una simulación: no sale dinero."),
          reminder: "Recordatorio 30 nov · Cementos del Valle · USD 1,260.00",
          simulatedPayment: true,
          ap: scene.ap.map((row) => ({ ...row, note: "Recordatorio el 30 nov. El pago no se ejecutó." })),
        }),
    },
  ],
};

pagar.steps.splice(6, 0, {
  id: "pedir",
  label: "Pedir el recordatorio",
  ms: 700,
  when: (scene) => scene.decision === "confirm",
  run: (scene) => ({
    ...scene,
    card: { title: "Pago sugerido", rows: [["Cuándo", "30 nov 2026"], ["Por qué", "El viernes el efectivo no sobra"]], actions: [{ id: "si", label: "Programar recordatorio" }, { id: "no", label: "Solo dejarla pendiente" }] },
  }),
});

const cobrar: Flow = {
  id: "cobrar",
  title: "Gestionar cuentas por cobrar",
  description: "Pides ayuda para cobrar, autorizas el mensaje y un depósito de demostración salda la factura.",
  opening: () => ({ ...emptyScene(), ar: [{ ...JOHNSON }] }),
  steps: [
    {
      id: "pedir",
      label: "Pedir el cobro",
      ms: 1400,
      compose: "Serbell, ayúdame a cobrarle a Johnson Construction.",
      run: (scene) => say(scene, "user", "Serbell, ayúdame a cobrarle a Johnson Construction."),
    },
    {
      id: "hallar",
      label: "Encontrar la factura",
      ms: 1100,
      cursor: "ar-johnson",
      run: (scene) => ({
        ...say(scene, "assistant", "FAC-880 está por vencer el 20 de noviembre, por USD 2,800.00. No hay mensajes de seguimiento todavía. Preparé este texto:"),
        route: "cobrar",
        card: {
          title: "Mensaje para Johnson Construction",
          rows: [["Texto", "La factura FAC-880, de USD 2,800.00, vence el 20 de noviembre. ¿Me confirmas la fecha de pago?"]],
          actions: [{ id: "si", label: "Autorizar el envío simulado" }, { id: "no", label: "No enviar" }],
        },
      }),
    },
    {
      id: "enviar",
      label: "Autorizar",
      ms: 900,
      wait: true,
      auto: "si",
      cursor: "choice-si",
      run: (scene, choice) => choice === "no"
        ? say({ ...scene, decision: "no", card: null }, "assistant", "No envié el mensaje.")
        : say({ ...scene, decision: "si", sent: true, card: null, ar: scene.ar.map((row) => ({ ...row, note: "Mensaje simulado enviado el 18 nov." })) }, "assistant", "Registré el envío simulado. No salió un correo real."),
    },
    {
      id: "deposito",
      label: "Llega el depósito",
      ms: 1400,
      when: (scene) => scene.decision === "si",
      run: (scene) => ({
        ...say(scene, "assistant", "Entró un depósito de demostración de Johnson Construction por USD 2,800.00. Lo vinculé con FAC-880. La factura quedó pagada."),
        movements: [{ id: "dep", merchant: "Johnson Construction", account: BANK, date: "19 nov 2026", amountCents: 280_000, description: "DEMO JOHNSON ACH", category: "Ingresos", subcategory: "Obra", receipt: "FAC-880", review: "Vinculado", spotlight: true }],
        ar: scene.ar.map((row) => ({ ...row, status: "Pagado", note: "Saldada con el depósito de demostración del 19 nov." })),
        linked: true,
      }),
    },
  ],
};

const proyectos: Flow = {
  id: "proyectos",
  title: "Analizar la rentabilidad de proyectos",
  description: "Tres obras. Una está perdiendo dinero y se puede abrir hasta el movimiento.",
  opening: () => ({ ...emptyScene(), projects: PROJECTS.map((item) => ({ ...item, lines: [...item.lines] })) }),
  steps: [
    {
      id: "pregunta",
      label: "La pregunta",
      ms: 1200,
      compose: "¿Cuál de mis proyectos es más rentable?",
      run: (scene) => say(scene, "user", "¿Cuál de mis proyectos es más rentable?"),
    },
    {
      id: "tabla",
      label: "Comparar obras",
      ms: 1200,
      cursor: "projects",
      run: (scene) => ({
        ...say(scene, "assistant", "Obra Norte deja USD 6,800.00. Obra Centro deja USD 2,300.00. Obra Sol pierde USD 1,800.00."),
        route: "proyectos",
      }),
    },
    { id: "abrir", label: "Abrir la pérdida", ms: 1000, cursor: "project-sol", click: true, run: (scene) => ({ ...scene, openProject: "sol" }) },
    {
      id: "accion",
      label: "Qué hacer",
      ms: 1400,
      run: (scene) => ({
        ...say(scene, "assistant", "En Obra Sol el cemento y las horas extra se comen el contrato. Congela las horas extra y revisa el precio del cemento antes de comprar más."),
        suggestion: "Congelar horas extra en Obra Sol.",
      }),
    },
  ],
};

const cierre: Flow = {
  id: "cierre",
  title: "Preparar el cierre contable",
  description: "El contador ve las excepciones de Rivera y las resuelve. El periodo no se cierra solo.",
  opening: () => ({
    ...emptyScene(),
    person: "carlos",
    route: "firma",
    firm: [
      { id: "rivera", name: "Rivera Construction", priority: "Alta", exceptions: ["2 movimientos sin categoría", "1 comprobante con importe distinto"], progress: 20 },
      { id: "qpl", name: "Quick Pick Logistics", priority: "Media", exceptions: ["1 posible duplicado"], progress: 60 },
    ],
  }),
  steps: [
    { id: "lista", label: "Empresas por prioridad", ms: 900, cursor: "firm-rivera", run: (scene) => scene },
    { id: "abrir", label: "Abrir Rivera", ms: 900, cursor: "firm-rivera", click: true, run: (scene) => ({ ...scene, firmOpen: "rivera" }) },
    {
      id: "resolver-1",
      label: "Categorías",
      ms: 1000,
      cursor: "resolve",
      click: true,
      run: (scene) => ({
        ...scene,
        firm: scene.firm.map((row) => row.id === "rivera" ? { ...row, exceptions: row.exceptions.slice(1), progress: 60 } : row),
      }),
    },
    {
      id: "resolver-2",
      label: "Importe",
      ms: 1000,
      cursor: "resolve",
      click: true,
      run: (scene) => ({
        ...scene,
        firm: scene.firm.map((row) => row.id === "rivera" ? { ...row, exceptions: [], progress: 100 } : row),
      }),
    },
    {
      id: "listo",
      label: "Listo para tu cierre",
      ms: 1400,
      run: (scene) => say(scene, "assistant", "No quedan excepciones en Rivera. El periodo no se cerró solo: cuando quieras, lo marcas listo para cierre."),
    },
  ],
};

const manana: Flow = {
  id: "manana",
  title: "Resumen financiero proactivo",
  description: "Luis abre la app y resuelve tres asuntos desde el chat.",
  opening: () => ({ ...emptyScene(), ar: [{ ...JOHNSON }], movements: bankMoves().filter((move) => move.id === "shell") }),
  steps: [
    {
      id: "saludo",
      label: "Buenos días",
      ms: 1400,
      run: (scene) => say(scene, "assistant", "Buenos días, Luis. Tus finanzas están al día. Hay tres asuntos que me gustaría revisar contigo."),
    },
    {
      id: "lista",
      label: "Los tres asuntos",
      ms: 800,
      run: (scene) => ({
        ...scene,
        card: {
          title: "Para hoy",
          rows: [
            ["1", "FAC-880 de Johnson vence el viernes"],
            ["2", "Puedes recuperar USD 2,800.00"],
            ["3", "Shell sigue sin comprobante"],
          ],
          actions: [{ id: "seguir", label: "Resolverlos" }],
        },
      }),
    },
    { id: "ir", label: "Empezar", ms: 600, wait: true, auto: "seguir", cursor: "choice-seguir", run: (scene) => ({ ...scene, card: null, decision: "seguir" }) },
    {
      id: "uno",
      label: "La factura",
      ms: 900,
      when: (scene) => scene.decision === "seguir" || scene.decision === "hecho",
      run: (scene) => ({
        ...say(scene, "assistant", "Johnson Construction vence el viernes. ¿Dejo el recordatorio en la factura?"),
        card: { title: "FAC-880", rows: [["Importe", "USD 2,800.00"]], actions: [{ id: "si", label: "Dejar el recordatorio" }] },
      }),
    },
    {
      id: "uno-si",
      label: "Recordatorio",
      ms: 700,
      wait: true,
      auto: "si",
      cursor: "choice-si",
      when: (scene) => scene.card?.title === "FAC-880",
      run: (scene) => ({
        ...say(scene, "assistant", "Listo. También es la forma de recuperar esos USD 2,800.00."),
        decision: "hecho",
        card: { title: "Shell", rows: [["Movimiento", "USD 64.80 sin comprobante"]], actions: [{ id: "adjuntar", label: "Adjuntar el ticket de Shell" }] },
        reminder: "Recordatorio de FAC-880 preparado.",
        ar: scene.ar.map((row) => ({ ...row, note: "Recordatorio preparado." })),
      }),
    },
    {
      id: "dos",
      label: "El ticket",
      ms: 700,
      wait: true,
      auto: "adjuntar",
      cursor: "choice-adjuntar",
      when: (scene) => scene.card?.title === "Shell",
      run: (scene) => ({
        ...say(scene, "assistant", "Ticket de Shell guardado y listo para Carlos."),
        card: null,
        documents: [{ id: "doc-shell", fileName: "Shell_Receipt.jpg", merchant: "Shell", amount: money(6_480), date: "16 nov 2026", status: "Listo para el contador" }],
        movements: scene.movements.map((move) => ({ ...move, receipt: "Shell_Receipt.jpg", review: "Listo para revisión" })),
        banner: "Todo está en orden. Seguiré monitoreando tus finanzas.",
      }),
    },
  ],
};

export const FLOWS: Flow[] = [ticket, duplicados, faltantes, utilidad, liquidez, pagar, cobrar, proyectos, cierre, manana];

export function play(flow: Flow, choices: Record<string, string> = {}) {
  let scene = cloneScene(flow.opening());
  const frames: Scene[] = [cloneScene(scene)];
  for (const step of flow.steps) {
    if (step.when && !step.when(scene)) continue;
    scene = step.run(cloneScene(scene), choices[step.id] ?? step.auto);
    frames.push(cloneScene(scene));
  }
  return frames;
}
