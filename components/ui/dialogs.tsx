"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

// Ventanas emergentes de la app (reemplazan confirm() y alert() del navegador).
// Uso, desde cualquier componente del navegador:
//   if (!(await confirmDialog({ title: "¿Eliminar?", message: "…", tone: "danger" }))) return;
//   await alertDialog({ title: "No se pudo guardar", message: err.message, tone: "danger" });
// <DialogHost /> está montado una sola vez en el layout raíz.

export type DialogTone = "danger" | "warning" | "info" | "success";

type DialogRequest = {
  kind: "confirm" | "alert";
  title: string;
  message?: React.ReactNode;
  tone: DialogTone;
  confirmText: string;
  cancelText: string;
  resolve: (ok: boolean) => void;
};

type ConfirmOptions = { title: string; message?: React.ReactNode; tone?: DialogTone; confirmText?: string; cancelText?: string };
type AlertOptions = { title: string; message?: React.ReactNode; tone?: DialogTone; confirmText?: string };

// Cola de ventanas: si llegan dos seguidas, se muestran una después de la otra
let queue: DialogRequest[] = [];
const listeners = new Set<() => void>();
const emit = () => listeners.forEach(l => l());
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
const current = () => queue[0] ?? null;

function open(req: Omit<DialogRequest, "resolve">) {
  return new Promise<boolean>(resolve => {
    queue = [...queue, { ...req, resolve }];
    emit();
  });
}

export function confirmDialog(o: ConfirmOptions): Promise<boolean> {
  return open({ kind: "confirm", title: o.title, message: o.message, tone: o.tone ?? "warning", confirmText: o.confirmText ?? "Aceptar", cancelText: o.cancelText ?? "Cancelar" });
}

export async function alertDialog(o: AlertOptions): Promise<void> {
  await open({ kind: "alert", title: o.title, message: o.message, tone: o.tone ?? "info", confirmText: o.confirmText ?? "Entendido", cancelText: "" });
}

const TONES: Record<DialogTone, { icon: string; ring: string; iconBg: string; button: string }> = {
  danger: { icon: "delete_forever", ring: "#fecaca", iconBg: "bg-red-100 text-red-600", button: "bg-red-600 hover:bg-red-700 shadow-red-900/20" },
  warning: { icon: "help", ring: "#fde68a", iconBg: "bg-amber-100 text-amber-700", button: "bg-slate-900 hover:bg-slate-800 shadow-slate-900/20" },
  info: { icon: "info", ring: "#bfdbfe", iconBg: "bg-blue-100 text-blue-700", button: "bg-slate-900 hover:bg-slate-800 shadow-slate-900/20" },
  success: { icon: "check_circle", ring: "#bbf7d0", iconBg: "bg-emerald-100 text-emerald-700", button: "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-900/20" },
};

export function DialogHost() {
  const dialog = useSyncExternalStore(subscribe, current, () => null);
  const confirmRef = useRef<HTMLButtonElement>(null);

  const close = (ok: boolean) => {
    const d = queue[0];
    if (!d) return;
    queue = queue.slice(1);
    emit();
    d.resolve(ok);
  };

  useEffect(() => {
    if (!dialog) return;
    confirmRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); close(dialog.kind === "alert"); }
      if (e.key === "Enter") { e.preventDefault(); close(true); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dialog]);

  if (!dialog) return null;
  const tone = TONES[dialog.tone];

  return createPortal(
    <div
      className="fixed inset-0 z-[20000] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-[#0A192F]/60 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={() => close(dialog.kind === "alert")}
    >
      <div
        role={dialog.kind === "confirm" ? "alertdialog" : "dialog"}
        aria-modal="true"
        aria-labelledby="app-dialog-title"
        onClick={e => e.stopPropagation()}
        className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl p-6 animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-200"
      >
        <div className="flex items-start gap-4">
          <span className={`w-12 h-12 shrink-0 rounded-2xl flex items-center justify-center ${tone.iconBg}`} style={{ boxShadow: `0 0 0 6px ${tone.ring}55` }}>
            <span className="material-symbols-outlined text-[26px]">{tone.icon}</span>
          </span>
          <div className="min-w-0 pt-0.5">
            <h2 id="app-dialog-title" className="text-[17px] font-bold text-slate-900 leading-snug">{dialog.title}</h2>
            {dialog.message && <div className="text-[14px] text-slate-600 leading-relaxed mt-1.5">{dialog.message}</div>}
          </div>
        </div>
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 mt-6">
          {dialog.kind === "confirm" && (
            <button onClick={() => close(false)} className="h-11 px-5 rounded-xl font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors">
              {dialog.cancelText}
            </button>
          )}
          <button
            ref={confirmRef}
            onClick={() => close(true)}
            className={`h-11 px-5 rounded-xl font-bold text-white shadow-md transition-colors focus:outline-none focus-visible:ring-4 focus-visible:ring-slate-300 ${tone.button}`}
          >
            {dialog.confirmText}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
