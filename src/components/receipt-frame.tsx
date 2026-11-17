"use client";

import { Download, X, ZoomIn, ZoomOut } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

export function ReceiptFrame({
  src,
  mime,
  fileName,
  closeHref,
}: {
  src: string;
  mime: string;
  fileName: string;
  closeHref: string;
}) {
  const [zoom, setZoom] = useState(1);
  const [failed, setFailed] = useState(false);
  const pdf = mime === "application/pdf" || fileName.toLowerCase().endsWith(".pdf");
  return (
    <div className="mt-3 overflow-hidden rounded-xl border border-border">
      <div className="flex items-center gap-1 border-b border-border bg-white px-2 py-1.5" data-testid="receipt-toolbar">
        <button
          type="button"
          aria-label="Reducir"
          data-testid="zoom-out"
          className="rounded-lg p-2 text-slate-600 hover:bg-slate-50"
          onClick={() => setZoom((value) => Math.max(0.5, Math.round((value - 0.25) * 100) / 100))}
        >
          <ZoomOut className="size-4" />
        </button>
        <span className="w-12 text-center text-xs text-slate-500">{Math.round(zoom * 100)}%</span>
        <button
          type="button"
          aria-label="Ampliar"
          data-testid="zoom-in"
          className="rounded-lg p-2 text-slate-600 hover:bg-slate-50"
          onClick={() => setZoom((value) => Math.min(2.5, Math.round((value + 0.25) * 100) / 100))}
        >
          <ZoomIn className="size-4" />
        </button>
        <a
          href={`${src}?descarga=1`}
          data-testid="receipt-download"
          className="ml-1 inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-primary"
        >
          <Download className="size-4" />
          Descargar
        </a>
        <Link href={closeHref} data-testid="receipt-close" className="ml-auto inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs text-slate-500">
          <X className="size-4" />
          Cerrar
        </Link>
      </div>
      <div className="max-h-[46vh] overflow-auto bg-slate-50">
        {failed ? (
          <p className="p-4 text-sm text-slate-500">No se puede previsualizar este archivo. Puedes descargarlo.</p>
        ) : pdf ? (
          <div style={{ width: `${zoom * 100}%`, height: `${680 * zoom}px` }}>
            <iframe
              title={fileName}
              src={src}
              data-testid="receipt-file"
              className="border-0 bg-white"
              style={{ width: `${100 / zoom}%`, height: "680px", transform: `scale(${zoom})`, transformOrigin: "top left" }}
            />
          </div>
        ) : (
          <img
            src={src}
            alt={fileName}
            data-testid="receipt-file"
            className="max-w-none"
            style={{ width: `${zoom * 100}%` }}
            onError={() => setFailed(true)}
          />
        )}
      </div>
    </div>
  );
}
