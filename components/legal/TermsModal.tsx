"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { TERMS, TERMS_DATE, TERMS_VERSION } from "@/lib/terms";

// Ventana con los términos y condiciones. Se abre en un portal para quedar por encima
// de cualquier contenedor (la tarjeta de login recorta lo que se sale de ella).
export function TermsModal({ open, onClose, onAccept }: { open: boolean; onClose: () => void; onAccept?: () => void }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[10000] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-[#0A192F]/70 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="terms-title"
        onClick={e => e.stopPropagation()}
        className="w-full sm:max-w-2xl max-h-[92vh] bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 duration-300"
      >
        <div className="flex items-start justify-between gap-4 px-6 pt-6 pb-4 border-b border-slate-100">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-red-600">AirPanama · Estación Enrique Malek</p>
            <h2 id="terms-title" className="text-xl font-bold text-slate-900 mt-1">Términos de uso y política de privacidad</h2>
            <p className="text-[12px] text-slate-500 mt-0.5">Versión {TERMS_VERSION} · {TERMS_DATE}</p>
          </div>
          <button onClick={onClose} aria-label="Cerrar" className="w-9 h-9 shrink-0 rounded-full bg-slate-50 hover:bg-slate-100 text-slate-500 flex items-center justify-center">
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-5 text-left">
          <div className="flex gap-3 p-3.5 rounded-2xl bg-emerald-50 border border-emerald-100">
            <span className="material-symbols-outlined text-emerald-600">verified_user</span>
            <p className="text-[13px] text-emerald-900 leading-relaxed">
              <strong>En resumen:</strong> tus datos se usan solo dentro de esta plataforma, para su seguridad y la auditoría de la operación. No se venden ni se comparten con fines comerciales, no hay cookies de seguimiento y la plataforma no está conectada a inteligencia artificial.
            </p>
          </div>
          {TERMS.map(section => (
            <section key={section.title}>
              <h3 className="text-[14px] font-bold text-slate-900">{section.title}</h3>
              {section.body.length === 1 ? (
                <p className="text-[13px] text-slate-600 leading-relaxed mt-1">{section.body[0]}</p>
              ) : (
                <ul className="mt-1 flex flex-col gap-1">
                  {section.body.map(line => (
                    <li key={line} className="text-[13px] text-slate-600 leading-relaxed flex gap-2">
                      <span className="text-slate-400">•</span><span>{line}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>

        <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3 bg-slate-50">
          <button onClick={onClose} className="h-11 px-5 rounded-xl font-bold text-slate-600 hover:bg-slate-100">Cerrar</button>
          {onAccept && (
            <button onClick={() => { onAccept(); onClose(); }} className="h-11 px-5 rounded-xl font-bold text-white bg-slate-900 hover:bg-slate-800 shadow-sm flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px]">check</span>
              Acepto los términos
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
