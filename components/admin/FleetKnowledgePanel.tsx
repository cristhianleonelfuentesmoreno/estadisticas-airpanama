"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { confirmFleetRows, deleteFleetRow, getFleetAdminData, saveFleetRow, type FleetRow, type FleetTable } from "@/app/actions/fleet";
import { confirmDialog } from "@/components/ui/dialogs";

// Base de conocimiento de flota y tripulación: la usan el lector de itinerarios,
// la importación de Excel y el formulario manual para no equivocarse.

type Kind = "text" | "upper" | "int" | "bool" | "list" | "time" | "role" | "aircraftCode";
type Col = { field: string; label: string; kind: Kind; width?: string; placeholder?: string; emptyLabel?: string };
type TabDef = { id: FleetTable; label: string; icon: string; key: string; review?: string; cols: Col[]; help: string };

const ROLE_LABEL: Record<string, string> = { capitan: "Capitán", primer_oficial: "Primer oficial", cabina: "Cabina" };

const TABS: TabDef[] = [
  {
    id: "aircraft_types", label: "Modelos", icon: "flight", key: "aircraft_code", review: "verified",
    help: "Capacidad de cada modelo. Los alias son cómo puede venir escrito en un itinerario o Excel (FK50 = F-50).",
    cols: [
      { field: "aircraft_code", label: "Código", kind: "upper", width: "w-24" },
      { field: "name", label: "Nombre", kind: "text", width: "w-48" },
      { field: "airline", label: "Aerolínea", kind: "text", width: "w-32" },
      { field: "pax_max", label: "Capacidad", kind: "int", width: "w-20" },
      { field: "aliases", label: "Alias (separados por coma)", kind: "list", width: "w-56" },
      { field: "verified", label: "Confirmado", kind: "bool" },
    ],
  },
  {
    id: "aircraft", label: "Matrículas", icon: "badge", key: "registration", review: "verified",
    help: "Qué modelo es cada avión. La matrícula decide el modelo y la capacidad, aunque el itinerario diga otra cosa.",
    cols: [
      { field: "registration", label: "Matrícula", kind: "upper", width: "w-28", placeholder: "HP-1997" },
      { field: "aircraft_code", label: "Modelo", kind: "aircraftCode", width: "w-32" },
      { field: "airline", label: "Aerolínea", kind: "text", width: "w-32" },
      { field: "notes", label: "Notas", kind: "text", width: "w-64" },
      { field: "verified", label: "Confirmado", kind: "bool" },
    ],
  },
  {
    id: "crew_members", label: "Tripulación", icon: "groups", key: "id",
    help: "En el itinerario, la 1ª línea de cada ida y vuelta son los pilotos y la 2ª la cabina. Los alias ayudan a reconocer nombres mal escritos.",
    cols: [
      { field: "full_name", label: "Nombre", kind: "upper", width: "w-52" },
      { field: "role", label: "Rol", kind: "role", width: "w-36" },
      { field: "aliases", label: "Alias", kind: "list", width: "w-48" },
      { field: "active", label: "Activo", kind: "bool" },
    ],
  },
  {
    id: "flight_routes", label: "Rutas", icon: "route", key: "id", review: "verified",
    help: "Minutos de vuelo por ruta y modelo, para calcular la hora de llegada. Cada ruta vale de ida y de vuelta (PAC-DAV sirve también para DAV-PAC). Si un avión tarda distinto, agrega la ruta con su modelo; \"Todos\" vale para los modelos sin tiempo propio.",
    cols: [
      { field: "airline", label: "Aerolínea", kind: "text", width: "w-32" },
      { field: "origin", label: "Aeropuerto", kind: "upper", width: "w-20" },
      { field: "destination", label: "↔ Aeropuerto", kind: "upper", width: "w-20" },
      { field: "aircraft_code", label: "Modelo", kind: "aircraftCode", width: "w-32", emptyLabel: "Todos" },
      { field: "estimated_duration_minutes", label: "Minutos", kind: "int", width: "w-20" },
      { field: "verified", label: "Confirmado", kind: "bool" },
    ],
  },
  {
    id: "scheduled_flights", label: "Vuelos regulares", icon: "event_repeat", key: "id",
    help: "Número + ruta de cada vuelo regular. Un número puede tener varios tramos (693: CHX-BOC y BOC-DAV). Sirve para detectar rutas mal leídas.",
    cols: [
      { field: "flight_number", label: "Vuelo", kind: "upper", width: "w-20" },
      { field: "origin", label: "Origen", kind: "upper", width: "w-20" },
      { field: "destination", label: "Destino", kind: "upper", width: "w-20" },
      { field: "usual_departure", label: "Salida", kind: "time", width: "w-24" },
      { field: "aircraft_code", label: "Modelo", kind: "aircraftCode", width: "w-32" },
      { field: "airline", label: "Aerolínea", kind: "text", width: "w-32" },
      { field: "active", label: "Activo", kind: "bool" },
    ],
  },
];

type Data = Record<FleetTable, FleetRow[]>;

export function FleetKnowledgePanel() {
  const [data, setData] = useState<Data | null>(null);
  const [tab, setTab] = useState<FleetTable>("aircraft_types");
  const [onlyReview, setOnlyReview] = useState(false);
  const [adding, setAdding] = useState(false);

  const reload = () => getFleetAdminData().then(setData).catch(() => toast.error("No se pudo cargar la flota"));
  // Cambio local inmediato (sin volver a pedir las 5 tablas)
  const patchRow = (table: FleetTable, key: string, keyField: string, patch: FleetRow) =>
    setData(d => d && { ...d, [table]: d[table].map(r => (String(r[keyField]) === key ? { ...r, ...patch } : r)) });
  const [confirmingAll, setConfirmingAll] = useState(false);
  useEffect(() => {
    getFleetAdminData().then(setData).catch(() => toast.error("No se pudo cargar la flota"));
  }, []);

  const def = TABS.find(t => t.id === tab)!;
  const pending = (t: TabDef) => (t.review && data ? data[t.id].filter(r => r[t.review!] === false).length : 0);
  const codes = useMemo(() => (data?.aircraft_types ?? []).map(t => String(t.aircraft_code)), [data]);
  const rows = (data?.[tab] ?? []).filter(r => !onlyReview || !def.review || r[def.review] === false);
  const toConfirm = def.review && data ? data[tab].filter(r => r[def.review!] === false) : [];

  const confirmAll = async () => {
    const keys = toConfirm.map(r => String(r[def.key]));
    const ok = await confirmDialog({
      title: `¿Confirmar ${keys.length} ${def.label.toLowerCase()} por revisar?`,
      message: "Confírmalos solo si ya revisaste que los datos son correctos. Si otro administrador debe verificarlos, cancela.",
      confirmText: "Sí, confirmar todos",
    });
    if (!ok) return;
    setConfirmingAll(true);
    const res = await confirmFleetRows(def.id, keys);
    setConfirmingAll(false);
    if (res.error) return toast.error(res.error);
    toast.success(`${keys.length} confirmado${keys.length === 1 ? "" : "s"}`);
    reload();
  };

  return (
    <div className="flex flex-col w-full bg-surface-container-lowest rounded-3xl p-6 md:p-8 shadow-sm border border-outline-variant/30 relative overflow-hidden mt-8">
      <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary/20"></div>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="font-headline-sm text-headline-sm font-bold text-on-surface flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">flight_class</span>
            Flota y tripulación
          </h2>
          <p className="font-body-sm text-on-surface-variant mt-1">
            Base de conocimiento para leer itinerarios y guardar vuelos sin errores
          </p>
        </div>
        {def.review && (
          <label className="flex items-center gap-2 font-label-md text-sm text-on-surface-variant cursor-pointer">
            <input type="checkbox" checked={onlyReview} onChange={e => setOnlyReview(e.target.checked)} />
            Solo por revisar
          </label>
        )}
      </div>

      <div className="flex gap-2 overflow-x-auto pb-4 custom-scrollbar mb-2">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => { setTab(t.id); setAdding(false); }}
            className={`whitespace-nowrap px-4 py-2 rounded-full font-label-md font-bold transition-colors flex items-center gap-1.5 ${
              tab === t.id ? "bg-on-surface text-surface-container-lowest" : "bg-surface-container hover:bg-surface-container-high text-on-surface"
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">{t.icon}</span>
            {t.label}
            {pending(t) > 0 && (
              <span className="ml-1 text-[11px] bg-amber-400 text-amber-950 rounded-full px-1.5">{pending(t)}</span>
            )}
          </button>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <p className="font-body-sm text-sm text-on-surface-variant">{def.help}</p>
        {toConfirm.length > 0 && (
          <button
            onClick={confirmAll}
            disabled={confirmingAll}
            className="shrink-0 inline-flex items-center gap-1.5 px-4 h-9 rounded-full border border-amber-500 text-amber-800 hover:bg-amber-50 font-label-md font-bold text-sm disabled:opacity-60"
          >
            <span className="material-symbols-outlined text-[18px]">done_all</span>
            {confirmingAll ? "Confirmando…" : `Confirmar todos (${toConfirm.length})`}
          </button>
        )}
      </div>

      {!data ? (
        <div className="p-8 text-center text-on-surface-variant animate-pulse">Cargando…</div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-outline-variant/30">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface-container-high text-on-surface-variant font-label-sm uppercase">
              <tr>
                {def.cols.map(c => <th key={c.field} className="px-3 py-2.5 whitespace-nowrap">{c.label}</th>)}
                <th className="px-3 py-2.5 text-right">
                  <button
                    onClick={() => setAdding(a => !a)}
                    className="inline-flex items-center gap-1 text-primary font-bold normal-case hover:underline"
                  >
                    <span className="material-symbols-outlined text-[16px]">{adding ? "close" : "add"}</span>
                    {adding ? "Cancelar" : "Agregar"}
                  </button>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/20">
              {adding && (
                <EditableRow
                  key="new"
                  def={def}
                  codes={codes}
                  row={Object.fromEntries(def.cols.map(c => [c.field, c.kind === "bool" ? true : c.kind === "role" ? "capitan" : c.field === "airline" ? "Air Panama" : null]))}
                  isNew
                  onSaved={() => { setAdding(false); reload(); }}
                />
              )}
              {rows.map(r => (
                <EditableRow
                  key={String(r[def.key])} def={def} codes={codes} row={r} onSaved={reload}
                  onPatched={patch => patchRow(def.id, String(r[def.key]), def.key, patch)}
                />
              ))}
              {rows.length === 0 && !adding && (
                <tr><td colSpan={def.cols.length + 1} className="p-6 text-center text-on-surface-variant">Nada por revisar aquí.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function EditableRow({ def, row, codes, isNew = false, onSaved, onPatched }: {
  def: TabDef; row: FleetRow; codes: string[]; isNew?: boolean; onSaved: () => void; onPatched?: (patch: FleetRow) => void;
}) {
  const [draft, setDraft] = useState<FleetRow>(row);
  const [saving, setSaving] = useState(false);
  const instantReview = (c: Col) => !isNew && c.field === def.review;
  const dirty = isNew || def.cols.some(c => !instantReview(c) && JSON.stringify(draft[c.field] ?? null) !== JSON.stringify(row[c.field] ?? null));
  const needsReview = !!def.review && row[def.review] === false;

  const save = async () => {
    setSaving(true);
    // El campo de confirmar ya se guardó al marcarlo
    const fields = isNew ? draft : Object.fromEntries(Object.entries(draft).filter(([f]) => f !== def.review));
    const res = await saveFleetRow(def.id, isNew ? null : String(row[def.key]), fields);
    setSaving(false);
    if (res.error) return toast.error(res.error);
    toast.success(isNew ? "Agregado" : "Guardado");
    onSaved();
  };

  // "Confirmado" se guarda al marcarlo, sin pulsar Guardar (solo cambia ese campo).
  // La casilla muestra lo guardado y luego se recarga, así la pantalla siempre coincide con la base.
  const toggleReview = async (checked: boolean) => {
    const field = def.review!;
    onPatched?.({ [field]: checked });
    const res = await saveFleetRow(def.id, String(row[def.key]), { [field]: checked });
    if (res.error) {
      onPatched?.({ [field]: !checked });
      toast.error(res.error);
    }
    onSaved();
  };

  const remove = async () => {
    if (!(await confirmDialog({ title: "¿Eliminar este registro?", message: "Se quitará de la base de flota y tripulación.", tone: "danger", confirmText: "Eliminar" }))) return;
    const res = await deleteFleetRow(def.id, String(row[def.key]));
    if (res.error) return toast.error(res.error);
    toast.success("Eliminado");
    onSaved();
  };

  const input = "h-9 px-2 rounded-lg bg-surface-container border border-outline-variant/30 focus:outline-none focus:ring-2 ring-primary/20";

  return (
    <tr className={needsReview ? "bg-amber-50" : isNew ? "bg-primary-fixed/30" : ""}>
      {def.cols.map(c => {
        const v = draft[c.field];
        const set = (value: FleetRow[string]) => setDraft(d => ({ ...d, [c.field]: value }));
        return (
          <td key={c.field} className="px-3 py-2 align-middle">
            {c.kind === "bool" ? (
              <input
                type="checkbox"
                checked={(instantReview(c) ? row[c.field] : v) === true}
                onChange={e => (instantReview(c) ? toggleReview(e.target.checked) : set(e.target.checked))}
                aria-label={c.label}
              />
            ) : c.kind === "role" ? (
              <select value={String(v ?? "capitan")} onChange={e => set(e.target.value)} className={`${input} ${c.width ?? ""}`}>
                {Object.entries(ROLE_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
            ) : c.kind === "aircraftCode" ? (
              <select value={String(v ?? "")} onChange={e => set(e.target.value || null)} className={`${input} ${c.width ?? ""}`}>
                <option value="">{c.emptyLabel ?? "—"}</option>
                {codes.map(code => <option key={code} value={code}>{code}</option>)}
              </select>
            ) : (
              <input
                type={c.kind === "int" ? "number" : c.kind === "time" ? "time" : "text"}
                value={Array.isArray(v) ? v.join(", ") : String(v ?? "")}
                placeholder={c.placeholder}
                onChange={e => set(c.kind === "list" ? e.target.value.split(",").map(s => s.trim()) : e.target.value)}
                className={`${input} ${c.width ?? "w-32"} ${c.kind === "upper" ? "uppercase" : ""}`}
                aria-label={c.label}
              />
            )}
          </td>
        );
      })}
      <td className="px-3 py-2 text-right whitespace-nowrap">
        {needsReview && !dirty && <span className="mr-2 text-[11px] font-bold text-amber-800 bg-amber-100 rounded-full px-2 py-0.5">Por revisar</span>}
        {dirty && (
          <button onClick={save} disabled={saving} className="px-3 h-8 rounded-full bg-primary text-on-primary font-label-md font-bold text-xs disabled:opacity-60">
            {saving ? "Guardando…" : "Guardar"}
          </button>
        )}
        {!isNew && (
          <button onClick={remove} className="ml-1 w-8 h-8 rounded-full text-error hover:bg-error/10 inline-flex items-center justify-center" aria-label="Eliminar">
            <span className="material-symbols-outlined text-[18px]">delete</span>
          </button>
        )}
      </td>
    </tr>
  );
}
