"use client";

import { useEffect, useRef, useState } from "react";

export function TicketThumb({ id, alt }: { id: string; alt: string }) {
  const [failed, setFailed] = useState(false);
  const ref = useRef<HTMLImageElement>(null);
  useEffect(() => {
    const image = ref.current;
    if (image?.complete && image.naturalWidth === 0) setFailed(true);
  }, []);
  if (failed) {
    return <div className="flex h-24 items-center justify-center rounded-lg bg-slate-50 text-xs text-slate-400">Sin vista previa</div>;
  }
  return (
    <img
      ref={ref}
      src={`/api/documents/${id}/file`}
      alt={alt}
      className="h-24 w-full rounded-lg border border-border bg-slate-50 object-cover object-top"
      onError={() => setFailed(true)}
    />
  );
}
