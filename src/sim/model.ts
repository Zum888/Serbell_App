import { formatUsd } from "@/lib/money";

export type SimRoute =
  | "inicio"
  | "comprobantes"
  | "movimientos"
  | "conciliacion"
  | "firma"
  | "cobrar"
  | "pagar"
  | "reportes"
  | "liquidez"
  | "proyectos";

export type Person = "luis" | "carlos";

export type Fields = {
  merchant: string;
  date: string;
  subtotal: string;
  tax: string;
  total: string;
  category: string;
};

export type SimMessage = { id: string; role: "user" | "assistant" | "status"; body: string };

export type SimDoc = {
  id: string;
  fileName: string;
  merchant: string;
  amount: string;
  date: string;
  status: string;
};

export type SimMove = {
  id: string;
  merchant: string;
  account: string;
  date: string;
  amountCents: number;
  description: string;
  category: string;
  subcategory: string;
  receipt: string | null;
  review: string;
  spotlight: boolean;
};

export type SimInvoice = {
  id: string;
  party: string;
  number: string;
  due: string;
  amountCents: number;
  status: string;
  note: string;
};

export type SimProject = {
  id: string;
  name: string;
  income: number;
  cost: number;
  lines: string[];
};

export type BridgeLine = {
  id: string;
  label: string;
  cents: number;
  note: string;
  records: string[];
};

export type FirmRow = {
  id: string;
  name: string;
  priority: string;
  exceptions: string[];
  progress: number;
};

export type Scene = {
  route: SimRoute;
  person: Person;
  messages: SimMessage[];
  card: { title: string; rows: [string, string][]; actions: { id: string; label: string }[] } | null;
  processing: string | null;
  fileReady: boolean;
  fileLabel: string;
  preview: boolean;
  dragOver: boolean;
  fields: Fields;
  editing: boolean;
  decision: string | null;
  documents: SimDoc[];
  movements: SimMove[];
  linked: boolean;
  highlight: string | null;
  notifications: { id: string; title: string; body: string }[];
  noticeOpen: boolean;
  duplicateNote: string | null;
  bridge: BridgeLine[] | null;
  bridgeOpen: string | null;
  cash: { day: string; cents: number }[] | null;
  cashNote: string | null;
  ar: SimInvoice[];
  ap: SimInvoice[];
  projects: SimProject[];
  openProject: string | null;
  firm: FirmRow[];
  firmOpen: string | null;
  banner: string | null;
  reminder: string | null;
  sent: boolean;
  simulatedPayment: boolean;
  suggestion: string | null;
};

export const RECEIPT: Fields = {
  merchant: "Home Depot",
  date: "18 de noviembre de 2026",
  subtotal: "450.00",
  tax: "35.20",
  total: "485.20",
  category: "Materiales de construcción",
};

export const BANK = "Chase Business Checking";

export const BRIDGE: BridgeLine[] = [
  {
    id: "utilidad",
    label: "Utilidad del periodo",
    cents: 1_240_000,
    note: "Ingresos menos costos y gastos.",
    records: ["Ingresos de obra USD 28,600.00", "Costos y gastos USD 16,200.00"],
  },
  {
    id: "cobrar",
    label: "Ventas pendientes de cobro",
    cents: -800_000,
    note: "Están en la utilidad y todavía no entran al banco.",
    records: ["Johnson Construction FAC-880 USD 2,800.00", "Cliente García FAC-702 USD 5,200.00"],
  },
  {
    id: "activo",
    label: "Compra de activo",
    cents: -620_000,
    note: "Salió efectivo y no es un gasto del periodo.",
    records: ["Equipo de corte USD 6,200.00"],
  },
  {
    id: "retiro",
    label: "Retiros del propietario",
    cents: -300_000,
    note: "Luis Rivera retiró efectivo. No es un gasto de la obra.",
    records: ["Retiro de Luis Rivera USD 3,000.00"],
  },
  {
    id: "banco",
    label: "Cambio en el banco",
    cents: -480_000,
    note: "Lo que de verdad se movió en Chase este periodo.",
    records: ["Chase Business Checking, 1 al 18 de noviembre"],
  },
];

export const CASH_GAP = [
  { day: "Mié 18", cents: 420_000 },
  { day: "Jue 19", cents: 330_000 },
  { day: "Vie 20", cents: -50_000 },
  { day: "Sáb 21", cents: -50_000 },
  { day: "Dom 22", cents: -50_000 },
  { day: "Lun 23", cents: -50_000 },
  { day: "Mar 24", cents: -50_000 },
];

export const CASH_WITH_COLLECTION = [
  { day: "Mié 18", cents: 420_000 },
  { day: "Jue 19", cents: 610_000 },
  { day: "Vie 20", cents: 230_000 },
  { day: "Sáb 21", cents: 230_000 },
  { day: "Dom 22", cents: 230_000 },
  { day: "Lun 23", cents: 230_000 },
  { day: "Mar 24", cents: 230_000 },
];

export const PROJECTS: SimProject[] = [
  { id: "norte", name: "Obra Norte", income: 1_800_000, cost: 1_120_000, lines: ["Contrato Norte USD 18,000.00", "Materiales USD 7,400.00", "Mano de obra USD 3,800.00"] },
  { id: "sol", name: "Obra Sol", income: 960_000, cost: 1_140_000, lines: ["Cemento USD 6,400.00", "Horas extra USD 3,200.00", "Renta de equipo USD 1,800.00"] },
  { id: "centro", name: "Obra Centro", income: 740_000, cost: 510_000, lines: ["Contrato Centro USD 7,400.00", "Acabados USD 5,100.00"] },
];

export const JOHNSON = {
  id: "ar-johnson",
  party: "Johnson Construction",
  number: "FAC-880",
  due: "20 nov 2026",
  amountCents: 280_000,
  status: "Por vencer",
  note: "Sin mensajes de seguimiento.",
};

export function dollarsToCents(input: string): number | null {
  const cleaned = input.replace(/[^\d.]/g, "");
  if (!cleaned) return null;
  const value = Number(cleaned);
  if (!Number.isFinite(value)) return null;
  return Math.round(value * 100);
}

export function emptyScene(): Scene {
  return {
    route: "inicio",
    person: "luis",
    messages: [],
    card: null,
    processing: null,
    fileReady: false,
    fileLabel: "HomeDepot_Receipt.jpg",
    preview: false,
    dragOver: false,
    fields: { ...RECEIPT },
    editing: false,
    decision: null,
    documents: [],
    movements: [],
    linked: false,
    highlight: null,
    notifications: [],
    noticeOpen: false,
    duplicateNote: null,
    bridge: null,
    bridgeOpen: null,
    cash: null,
    cashNote: null,
    ar: [],
    ap: [],
    projects: [],
    openProject: null,
    firm: [],
    firmOpen: null,
    banner: null,
    reminder: null,
    sent: false,
    simulatedPayment: false,
    suggestion: null,
  };
}

export function say(scene: Scene, role: SimMessage["role"], body: string): Scene {
  return {
    ...scene,
    processing: null,
    messages: [...scene.messages, { id: `m-${scene.messages.length + 1}`, role, body }],
  };
}

export function money(cents: number) {
  return formatUsd(cents);
}

export function cloneScene(scene: Scene): Scene {
  return structuredClone(scene);
}
