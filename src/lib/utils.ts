import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function safeNext(value: string | null, fallback: string): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) {
    return fallback;
  }
  return value;
}

export function safeFileName(name: string): string {
  const base = name.split(/[/\\]/).pop() ?? "comprobante";
  return base.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 80) || "comprobante";
}
