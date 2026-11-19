"use client";

import { useEffect, useRef, useState } from "react";
import { SimStage } from "@/components/sim-stage";
import { FLOWS, type Flow, type Step } from "@/sim/flows";
import { cloneScene, type Scene } from "@/sim/model";

type Mode = "auto" | "interactivo";
type Speed = 0.5 | 1 | 2;

export function Simulator() {
  const [picker, setPicker] = useState(false);
  const [flow, setFlow] = useState<Flow | null>(null);
  return (
    <>
      <button
        type="button"
        data-sim-launcher
        onClick={() => setPicker(true)}
        className="relative z-[60] rounded-full border border-border bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:border-slate-300"
      >
        Simular flujo
      </button>
      {picker ? (
        <div className="fixed inset-0 z-[70] grid place-items-center bg-slate-950/30 p-4" onClick={() => setPicker(false)}>
          <div className="max-h-[80vh] w-full max-w-lg overflow-auto rounded-3xl bg-white p-5 shadow-xl" onClick={(event) => event.stopPropagation()}>
            <h2 className="text-lg font-semibold">Simular flujo</h2>
            <p className="mt-1 text-sm text-slate-500">Cada recorrido usa una escena aparte. Al salir, la app queda como estaba.</p>
            <ul className="mt-4 space-y-2">
              {FLOWS.map((item) => (
                <li key={item.id} className="rounded-2xl border border-border p-3">
                  <p className="font-medium">{item.title}</p>
                  <p className="mt-1 text-sm text-slate-500">{item.description}</p>
                  <button
                    type="button"
                    className="mt-2 rounded-full bg-slate-950 px-3 py-1.5 text-xs font-medium text-white"
                    onClick={() => {
                      setFlow(item);
                      setPicker(false);
                    }}
                  >
                    Iniciar
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}
      {flow ? <Player key={flow.id} flow={flow} onExit={() => setFlow(null)} /> : null}
    </>
  );
}

function Player({ flow, onExit }: { flow: Flow; onExit: () => void }) {
  const [scene, setScene] = useState<Scene>(() => cloneScene(flow.opening()));
  const [index, setIndex] = useState(0);
  const [history, setHistory] = useState<{ index: number; scene: Scene }[]>([]);
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState<Speed>(1);
  const [mode, setMode] = useState<Mode>("auto");
  const [cursor, setCursor] = useState({ x: 280, y: 180, click: false });
  const [ghost, setGhost] = useState<{ x: number; y: number; live: boolean } | null>(null);
  const [typed, setTyped] = useState("");
  const sceneRef = useRef(scene);
  const indexRef = useRef(index);
  const timerRef = useRef<number | null>(null);
  const skipRef = useRef<number | null>(null);
  sceneRef.current = scene;
  indexRef.current = index;
  const step = flow.steps[index];

  function clearTimer() {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = null;
  }

  function commit(current: Step, choice?: string) {
    clearTimer();
    const now = sceneRef.current;
    if (current.when && !current.when(now)) {
      setIndex((value) => value + 1);
      return;
    }
    const next = current.run(cloneScene(now), choice);
    setHistory((frames) => [...frames, { index: indexRef.current, scene: cloneScene(now) }]);
    setScene(next);
    setIndex((value) => value + 1);
  }

  useEffect(() => {
    if (!step?.when || step.when(sceneRef.current)) return;
    if (skipRef.current === index) return;
    skipRef.current = index;
    setIndex(index + 1);
  }, [index, step, scene.decision]);

  useEffect(() => {
    if (!playing || !step) return;
    if (step.when && !step.when(sceneRef.current)) return;
    if (step.wait && mode === "interactivo") return;
    timerRef.current = window.setTimeout(() => commit(step, step.wait ? step.auto : undefined), step.ms / speed);
    return clearTimer;
  }, [playing, index, speed, mode, flow, step]);

  useEffect(() => {
    if (!step?.compose) {
      setTyped("");
      return;
    }
    const text = step.compose;
    const total = step.ms / speed;
    const started = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const portion = Math.min(1, (now - started) / total);
      setTyped(text.slice(0, Math.ceil(portion * text.length)));
      if (portion < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [step, speed]);

  useEffect(() => {
    const target = step?.cursor;
    if (!target) return;
    const node = document.querySelector(`[data-sim="${target}"]`);
    if (!node) return;
    node.scrollIntoView({ block: "center", behavior: "smooth" });
    const box = node.getBoundingClientRect();
    setCursor({ x: box.left + Math.min(28, box.width * 0.35), y: box.top + box.height * 0.45, click: Boolean(step?.click) });
    if (!step?.click) return;
    const pulse = window.setTimeout(() => setCursor((point) => ({ ...point, click: false })), 280);
    return () => window.clearTimeout(pulse);
  }, [index, scene.route, scene.noticeOpen, scene.editing, scene.card, step]);

  useEffect(() => {
    if (!step?.drag) {
      setGhost(null);
      return;
    }
    const from = document.querySelector("[data-sim='file-chip']");
    const to = document.querySelector("[data-sim='chat-drop']");
    if (!from || !to) return;
    const start = from.getBoundingClientRect();
    const end = to.getBoundingClientRect();
    setGhost({ x: start.left, y: start.top, live: false });
    const frame = requestAnimationFrame(() => setGhost({ x: end.left + 20, y: end.top + 16, live: true }));
    return () => cancelAnimationFrame(frame);
  }, [index, step]);

  useEffect(() => {
    function block(event: MouseEvent) {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      if (target.closest("[data-sim-root], [data-sim-bar], [data-sim-launcher]")) return;
      if (target.closest("aside, header")) {
        event.preventDefault();
        event.stopPropagation();
      }
    }
    document.addEventListener("click", block, true);
    return () => document.removeEventListener("click", block, true);
  }, []);

  function choose(id: string) {
    if (!step?.wait) return;
    commit(step, id);
    setPlaying(true);
  }

  function edit(key: keyof Scene["fields"], value: string) {
    setScene((current) => ({ ...current, fields: { ...current.fields, [key]: value } }));
  }

  const done = index >= flow.steps.length;
  const mark = step?.highlight ?? scene.highlight;

  return (
    <>
      <div className="fixed bottom-0 right-0 top-16 z-40 overflow-auto bg-background" style={{ left: 232 }}>
        <SimStage scene={scene} compose={typed} mark={mark} onChoice={choose} onField={edit} />
      </div>
      {ghost ? (
        <div className="pointer-events-none fixed z-[60] rounded-2xl border border-border bg-white px-3 py-2 text-sm shadow-lg transition-all duration-700" style={{ left: ghost.x, top: ghost.y }}>
          {scene.fileLabel}
        </div>
      ) : null}
      <div className="pointer-events-none fixed z-[60] transition-all duration-700 ease-out" style={{ left: cursor.x, top: cursor.y }}>
        <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden>
          <path d="M4 2 L4 18 L8.5 14.2 L12.2 20 L14.6 19 L11 13.2 L17 13 Z" fill="#0f172a" stroke="white" strokeWidth="1.2" />
        </svg>
        {cursor.click ? <span className="absolute left-0 top-0 size-4 animate-ping rounded-full bg-primary/40" /> : null}
      </div>
      <div data-sim-bar className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full border border-border bg-white px-3 py-2 text-xs shadow-lg">
        <button type="button" onClick={() => setPlaying((value) => !value)} className="rounded-full bg-slate-950 px-3 py-1.5 font-medium text-white">
          {playing && !done ? "Pausar" : "Reproducir"}
        </button>
        <button type="button" onClick={() => {
          clearTimer();
          setPlaying(false);
          skipRef.current = null;
          const frame = history[history.length - 1];
          if (!frame) return;
          setHistory((frames) => frames.slice(0, -1));
          setScene(frame.scene);
          setIndex(frame.index);
        }}>Anterior</button>
        <button type="button" onClick={() => {
          if (!step) return;
          clearTimer();
          setPlaying(false);
          commit(step, step.wait ? step.auto : undefined);
        }}>Siguiente</button>
        <button type="button" onClick={() => {
          clearTimer();
          setPlaying(false);
          skipRef.current = null;
          setScene(cloneScene(flow.opening()));
          setIndex(0);
          setHistory([]);
        }}>Reiniciar</button>
        {([0.5, 1, 2] as Speed[]).map((value) => (
          <button key={value} type="button" onClick={() => setSpeed(value)} className={speed === value ? "font-semibold text-primary" : "text-slate-500"}>{value}x</button>
        ))}
        <button type="button" onClick={() => setMode((value) => value === "auto" ? "interactivo" : "auto")} className="text-slate-600">
          {mode === "auto" ? "Automático" : "Interactivo"}
        </button>
        <span className="text-slate-400">{done ? "Listo" : `${Math.min(index + 1, flow.steps.length)}/${flow.steps.length}`}</span>
        <button type="button" onClick={onExit}>Salir</button>
      </div>
    </>
  );
}
