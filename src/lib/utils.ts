import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const REDIRECT_BASE = "http://serbell.local";

function hasRedirectBypass(value: string): boolean {
  if (/[\u0000-\u0020\u007F\u2028\u2029\\]/.test(value)) return true;
  let current = value;
  for (let i = 0; i < 3 && current.includes("%"); i += 1) {
    let decoded: string;
    try {
      decoded = decodeURIComponent(current);
    } catch {
      return true;
    }
    if (decoded === current) break;
    current = decoded;
    if (/[\u0000-\u0020\u007F\u2028\u2029\\]/.test(current)) return true;
    if (current.startsWith("//") || current.includes("://")) return true;
  }
  return false;
}

/** Same-origin path only. Tabs, newlines, backslashes, and encoded variants stay on the fallback. */
export function safeNext(value: string | null, fallback: string): string {
  if (!value) return fallback;
  if (!value.startsWith("/") || value.startsWith("//") || hasRedirectBypass(value)) return fallback;
  let url: URL;
  try {
    url = new URL(value, REDIRECT_BASE);
  } catch {
    return fallback;
  }
  if (url.origin !== REDIRECT_BASE || url.username || url.password) return fallback;
  const path = `${url.pathname}${url.search}`;
  if (!path.startsWith("/") || path.startsWith("//") || hasRedirectBypass(path)) return fallback;
  return path;
}

export function safeFileName(name: string): string {
  const base = name.split(/[/\\]/).pop() ?? "comprobante";
  return base.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 80) || "comprobante";
}
