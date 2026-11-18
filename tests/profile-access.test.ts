import { expect, it } from "vitest";
import { USER } from "@/lib/ids";
import { assertProfileAllowed } from "@/server/session";

const PUBLIC = `v_${"ab".repeat(16)}`;

it("el visitante público solo puede usar el perfil de propietario", () => {
  expect(() => assertProfileAllowed(PUBLIC, USER.padrino, false)).not.toThrow();
  expect(() => assertProfileAllowed(PUBLIC, USER.ana, false)).toThrowError(/propietario/);
  expect(() => assertProfileAllowed(PUBLIC, USER.carlos, true)).toThrowError(/propietario/);
  expect(() => assertProfileAllowed(PUBLIC, USER.luis, false)).toThrowError(/propietario/);
});

it("contador y administración requieren una sesión de Cursor", () => {
  expect(() => assertProfileAllowed("user:1", USER.ana, false)).toThrowError(/Cursor/);
  expect(() => assertProfileAllowed("user:1", USER.carlos, false)).toThrowError(/Cursor/);
  expect(() => assertProfileAllowed("user:1", USER.ana, true)).not.toThrow();
  expect(() => assertProfileAllowed("user:1", USER.luis, false)).not.toThrow();
});
