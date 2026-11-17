export const FIRM_ID = "firm_despacho";

export const USER = {
  padrino: "usr_padrino",
  luis: "usr_luis",
  carlos: "usr_carlos",
  ana: "usr_ana",
} as const;

export const COMPANY = {
  qpl: "co_qpl",
  rivera: "co_rivera",
} as const;

export const ACCOUNT = {
  qpl: "acct_qpl_boa",
  rivera: "acct_riv_chase",
} as const;

export const TX = {
  fs20394: "tx_qpl_fs_20394",
  fs21148: "tx_qpl_fs_21148",
  income200: "tx_qpl_income_200",
  sunpass03: "tx_qpl_sunpass_03",
  carlosDavid: "tx_qpl_carlos_david",
  fs15012: "tx_qpl_fs_15012",
  sunpass27: "tx_qpl_sunpass_27",
  brian: "tx_qpl_brian",
  homeDepot: "tx_riv_homedepot",
  garcia: "tx_riv_garcia",
  shell: "tx_riv_shell",
  ace: "tx_riv_ace",
} as const;

export const CAT = {
  qpl: {
    transporte: "cat_qpl_transporte",
    combustible: "cat_qpl_combustible",
    peajes: "cat_qpl_peajes",
    ingresos: "cat_qpl_ingresos",
    servicios: "cat_qpl_servicios",
    operacion: "cat_qpl_operacion",
    mantenimiento: "cat_qpl_mantenimiento",
    equipo: "cat_qpl_equipo",
    administracion: "cat_qpl_administracion",
    honorarios: "cat_qpl_honorarios",
  },
  rivera: {
    transporte: "cat_riv_transporte",
    combustible: "cat_riv_combustible",
    peajes: "cat_riv_peajes",
    ingresos: "cat_riv_ingresos",
    servicios: "cat_riv_servicios",
    operacion: "cat_riv_operacion",
    mantenimiento: "cat_riv_mantenimiento",
    equipo: "cat_riv_equipo",
    administracion: "cat_riv_administracion",
    honorarios: "cat_riv_honorarios",
  },
} as const;

export const PROFILES = [
  {
    id: USER.padrino,
    name: "Padrino",
    role: "Propietario",
    company: "Quick Pick Logistics",
    initials: "PD",
    home: "/",
  },
  {
    id: USER.luis,
    name: "Luis Rivera",
    role: "Propietario",
    company: "Rivera Construction",
    initials: "LR",
    home: "/",
  },
  {
    id: USER.carlos,
    name: "Carlos Ruiz",
    role: "Contador",
    company: "Despacho Contable",
    initials: "CR",
    home: "/firma",
  },
  {
    id: USER.ana,
    name: "Ana Martínez",
    role: "Administración",
    company: "Despacho Contable",
    initials: "AM",
    home: "/firma",
  },
] as const;

export const PROFILE_COMPANY: Record<string, string> = {
  [USER.padrino]: COMPANY.qpl,
  [USER.luis]: COMPANY.rivera,
  [USER.carlos]: COMPANY.qpl,
  [USER.ana]: COMPANY.qpl,
};
