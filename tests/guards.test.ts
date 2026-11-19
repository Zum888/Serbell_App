import { expect, it } from "vitest";
import { accessConfigured, passwordMatches } from "@/server/access";
import { clearLoginFailures, clientAddress, loginAllowed, loginBucketKey, noteLoginFailure, resetLoginLimits } from "@/server/login-limit";
import { requestIsSameOrigin } from "@/server/same-origin";
import { originOf } from "@/server/http";

it("ignores an untrusted forwarded host", () => {
  const request = new Request("http://127.0.0.1:3000/api/acceso", {
    headers: { "x-forwarded-host": "evil.example", host: "127.0.0.1:3000" },
  });
  expect(originOf(request)).toBe("http://127.0.0.1:3000");
});

it("keeps the published host and forces https", () => {
  const request = new Request("http://localhost:3000/api/acceso", {
    headers: { "x-forwarded-host": "serbell-reconciliation.apps.grok.bot" },
  });
  expect(originOf(request)).toBe("https://serbell-reconciliation.apps.grok.bot");
});

it("accepts a same-origin browser call and rejects another site", () => {
  const same = new Headers({ host: "serbell-reconciliation.apps.grok.bot", "sec-fetch-site": "same-origin" });
  const other = new Headers({
    host: "serbell-reconciliation.apps.grok.bot",
    origin: "https://evil.example",
    "sec-fetch-site": "cross-site",
  });
  const fetchSame = new Headers({ host: "127.0.0.1:3000", origin: "http://127.0.0.1:3000" });
  expect(requestIsSameOrigin(same)).toBe(true);
  expect(requestIsSameOrigin(other)).toBe(false);
  expect(requestIsSameOrigin(fetchSame)).toBe(true);
  expect(requestIsSameOrigin(new Headers({ host: "127.0.0.1:3000" }))).toBe(false);
});

it("locks the password gate after eight failures", () => {
  resetLoginLimits();
  const now = 1_000_000;
  for (let attempt = 0; attempt < 7; attempt += 1) noteLoginFailure("203.0.113.4", now);
  expect(loginAllowed("203.0.113.4", now)).toBe(true);
  noteLoginFailure("203.0.113.4", now);
  expect(loginAllowed("203.0.113.4", now)).toBe(false);
  expect(loginAllowed("203.0.113.4", now + 15 * 60 * 1000)).toBe(true);
  clearLoginFailures("203.0.113.4");
  expect(loginAllowed("203.0.113.4", now)).toBe(true);
});

it("no abre el laboratorio con una contraseña corta", () => {
  const previous = process.env.SERBELL_ACCESS_PASSWORD;
  process.env.SERBELL_ACCESS_PASSWORD = "corta";
  expect(passwordMatches("corta")).toBe(false);
  expect(accessConfigured()).toBe(false);
  process.env.SERBELL_ACCESS_PASSWORD = "clave-de-prueba";
  expect(passwordMatches("clave-de-prueba")).toBe(true);
  if (previous === undefined) delete process.env.SERBELL_ACCESS_PASSWORD;
  else process.env.SERBELL_ACCESS_PASSWORD = previous;
});

it("no junta a todos los visitantes en un mismo límite cuando falta la dirección", () => {
  const bare = new Request("http://127.0.0.1/api/acceso");
  const one = new Request("http://127.0.0.1/api/acceso", { headers: { cookie: "sb_gate=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" } });
  const two = new Request("http://127.0.0.1/api/acceso", { headers: { cookie: "sb_gate=bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" } });
  expect(clientAddress(bare)).toBeNull();
  expect(loginBucketKey(bare)).toBeNull();
  expect(loginBucketKey(one)).not.toBe(loginBucketKey(two));
});
