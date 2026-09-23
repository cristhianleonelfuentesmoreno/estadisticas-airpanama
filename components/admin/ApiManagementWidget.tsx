"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { getApiConfigs, saveApiConfig } from "@/app/actions/apiConfig";

// Máscara visual para mostrar una llave configurada sin revelarla
function maskKey(key: string): string {
  if (!key) return "";
  if (key.length <= 8) return "••••••••";
  return key.substring(0, 4) + "••••••••••••" + key.substring(key.length - 4);
}

interface ApiKeyCardProps {
  icon: string;
  iconColor: string;
  title: string;
  description: string;
  savedKey: string;
  isActive: boolean;
  onActiveChange: (val: boolean) => void;
  onSaveKey: (key: string) => void;
  onDeleteKey: () => void;
}

function ApiKeyCard({
  icon,
  iconColor,
  title,
  description,
  savedKey,
  isActive,
  onActiveChange,
  onSaveKey,
  onDeleteKey,
}: ApiKeyCardProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  const hasKey = !!savedKey;

  const handleConfirm = () => {
    if (!draft.trim()) {
      toast.error("La llave no puede estar vacía");
      return;
    }
    onSaveKey(draft.trim());
    setDraft("");
    setEditing(false);
  };

  const handleCancel = () => {
    setDraft("");
    setEditing(false);
  };

  return (
    <div className="flex flex-col gap-3 p-4 rounded-2xl bg-surface-container border border-outline-variant/30">
      {/* Header row */}
      <div className="flex justify-between items-center">
        <h3 className="font-label-lg font-bold text-on-surface flex items-center gap-2 text-[15px]">
          <span className={`material-symbols-outlined text-[20px] ${iconColor}`}>{icon}</span>
          {title}
        </h3>
        {/* Toggle activo/inactivo */}
        <label className="flex items-center cursor-pointer">
          <div className="relative">
            <input
              type="checkbox"
              className="sr-only"
              checked={isActive}
              onChange={(e) => onActiveChange(e.target.checked)}
            />
            <div className={`block w-14 h-8 rounded-full transition-colors ${isActive ? "bg-primary" : "bg-surface-variant"}`} />
            <div
              className={`dot absolute left-1 top-1 bg-white w-6 h-6 rounded-full shadow transition-transform ${isActive ? "transform translate-x-6" : ""}`}
            />
          </div>
        </label>
      </div>

      {/* Key display / edit area */}
      {!editing ? (
        <div className="flex flex-col gap-2">
          {/* Estado de la llave */}
          <div
            className={`flex items-center justify-between px-4 py-3 rounded-xl border ${
              hasKey
                ? "bg-emerald-50 border-emerald-200"
                : "bg-amber-50 border-amber-200"
            }`}
          >
            <div className="flex items-center gap-2">
              <span
                className={`material-symbols-outlined text-[18px] ${
                  hasKey ? "text-emerald-600" : "text-amber-500"
                }`}
              >
                {hasKey ? "check_circle" : "warning"}
              </span>
              <span
                className={`text-[13px] font-semibold font-mono tracking-wider ${
                  hasKey ? "text-emerald-800" : "text-amber-700"
                }`}
              >
                {hasKey ? maskKey(savedKey) : "Sin llave configurada"}
              </span>
            </div>
            {hasKey && (
              <span className="text-[12px] font-bold uppercase tracking-wide bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">
                Activa
              </span>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex gap-2 mt-1">
            <button
              onClick={() => { setDraft(""); setEditing(true); }}
              className="flex-1 flex items-center justify-center gap-1.5 h-10 rounded-xl border border-primary/40 text-primary text-[13px] font-bold hover:bg-primary/10 transition-colors"
            >
              <span className="material-symbols-outlined text-[16px]">
                {hasKey ? "swap_horiz" : "add"}
              </span>
              {hasKey ? "Reemplazar llave" : "Añadir llave"}
            </button>
            {hasKey && (
              <button
                onClick={onDeleteKey}
                className="flex items-center justify-center gap-1.5 h-10 px-4 rounded-xl border border-rose-300 text-rose-500 text-[13px] font-bold hover:bg-rose-50 transition-colors"
              >
                <span className="material-symbols-outlined text-[16px]">delete</span>
                Eliminar
              </button>
            )}
          </div>

          {/* Costo / consumo info */}
          <div className="flex items-center gap-1.5 bg-emerald-500/10 px-3 py-2 rounded-lg border border-emerald-500/20">
            <span className="material-symbols-outlined text-[15px] text-emerald-600">monitoring</span>
            <span className="font-label-sm text-[12px] text-emerald-700 font-medium">{description}</span>
          </div>
        </div>
      ) : (
        /* Edit mode - no type="password" to avoid password manager */
        <div className="flex flex-col gap-3 animate-in fade-in slide-in-from-top-2 duration-200">
          <label className="text-[12px] font-bold text-on-surface-variant uppercase tracking-wider">
            {hasKey ? "Nueva llave (reemplazará la actual)" : "Pega tu API Key aquí"}
          </label>
          <textarea
            // textarea no activa el gestor de contraseñas del navegador
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            rows={2}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Pega aquí la llave de API..."
            className="w-full px-4 py-3 rounded-xl bg-surface-container-high font-mono text-[13px] text-on-surface focus:outline-none focus:ring-2 ring-primary/30 resize-none placeholder:text-on-surface-variant/40 border border-outline-variant/40"
          />
          <div className="flex gap-2">
            <button
              onClick={handleConfirm}
              className="flex-1 h-10 rounded-xl bg-primary text-on-primary text-[13px] font-bold flex items-center justify-center gap-1.5 hover:bg-primary/90 transition-colors"
            >
              <span className="material-symbols-outlined text-[16px]">check</span>
              Confirmar
            </button>
            <button
              onClick={handleCancel}
              className="h-10 px-4 rounded-xl border border-outline-variant text-on-surface-variant text-[13px] font-bold hover:bg-surface-container transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function ApiManagementWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const [geminiKey, setGeminiKey] = useState("");
  const [geminiActive, setGeminiActive] = useState(true);

  const loadConfigs = async () => {
    try {
      const configs = await getApiConfigs();
      if (configs.gemini) {
        setGeminiKey(configs.gemini.api_key);
        setGeminiActive(configs.gemini.is_active);
      }
    } catch (e) {
      console.error(e);
      toast.error("Error al cargar configuración de APIs");
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadConfigs();
    }
  }, [isOpen]);

  const handleSave = async () => {
    setLoading(true);
    try {
      await saveApiConfig("gemini", geminiKey, geminiActive);
      toast.success("Configuración de APIs guardada correctamente");
      setIsOpen(false);
    } catch (error: any) {
      toast.error(error.message || "Error al guardar configuración");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Trigger card */}
      <div
        onClick={() => setIsOpen(true)}
        className="bg-surface-container-lowest rounded-3xl p-6 shadow-sm border border-outline-variant/30 flex items-center justify-between cursor-pointer hover:border-primary/50 transition-colors group"
      >
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-secondary-container text-on-secondary-container flex items-center justify-center group-hover:bg-primary group-hover:text-on-primary transition-colors">
            <span className="material-symbols-outlined text-[24px]">key</span>
          </div>
          <div>
            <h3 className="font-headline-sm text-headline-sm font-bold text-on-surface">Gestión de API</h3>
            <p className="font-body-md text-body-md text-on-surface-variant mt-0.5">Configurar Google Gemini</p>
          </div>
        </div>
        <span className="material-symbols-outlined text-on-surface-variant">chevron_right</span>
      </div>

      {isOpen && (
        <div className="fixed inset-0 z-[100] bg-surface/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-xl bg-surface-container-lowest rounded-[28px] flex flex-col shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-outline-variant/20">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center">
                  <span className="material-symbols-outlined text-[20px]">api</span>
                </div>
                <div>
                  <h2 className="font-headline-md text-headline-md font-bold text-on-surface">Gestión de API</h2>
                  <p className="text-[12px] text-on-surface-variant">Las llaves están encriptadas en la base de datos</p>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="w-10 h-10 rounded-full hover:bg-surface-container-high flex items-center justify-center text-on-surface-variant transition-colors"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {/* API Cards */}
            <div className="p-6 overflow-y-auto flex flex-col gap-4 max-h-[70vh]">
              <ApiKeyCard
                icon="smart_toy"
                iconColor="text-purple-500"
                title="Google Gemini (Extracción IA)"
                description="Costo: ~$0.00002 por foto analizada (Gratis hasta 1,500 fotos/día)"
                savedKey={geminiKey}
                isActive={geminiActive}
                onActiveChange={setGeminiActive}
                onSaveKey={(k) => setGeminiKey(k)}
                onDeleteKey={() => setGeminiKey("")}
              />
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-outline-variant/20 flex justify-end gap-3 bg-surface-container-low rounded-b-[28px]">
              <button
                onClick={() => setIsOpen(false)}
                className="px-6 py-2.5 rounded-full font-label-md font-bold text-on-surface-variant hover:bg-surface-variant transition-colors"
                disabled={loading}
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={loading}
                className="px-6 py-2.5 rounded-full font-label-md font-bold bg-primary text-on-primary hover:bg-primary/90 transition-colors flex items-center gap-2 shadow-sm"
              >
                {loading ? (
                  <span className="material-symbols-outlined animate-spin text-[18px]">sync</span>
                ) : (
                  <span className="material-symbols-outlined text-[18px]">save</span>
                )}
                Guardar Cambios
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
