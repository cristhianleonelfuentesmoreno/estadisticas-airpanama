import { useState, useMemo } from "react";
import { AIRPORTS, applyEdit, markDuplicates, willSave, type ImportResult, type ImportRow, type RowPatch } from "@/lib/import/registroMensual";

const PAGE_SIZE = 100;
type Tab = 'ALL' | 'Air Panama' | 'Copa Airlines' | 'AVISOS' | 'OMITIDOS';

// Rehace la detección de duplicados sobre copias (el estado de React no se muta)
const withDuplicates = (rows: ImportRow[]) => {
  const copy = rows.map(r => ({ ...r }));
  markDuplicates(copy);
  return copy;
};

export function ExcelImportPreviewModal({
  data,
  onConfirm,
  onCancel
}: {
  data: ImportResult;
  onConfirm: (rows: ImportRow[]) => void;
  onCancel: () => void;
}) {
  const [rows, setRows] = useState<ImportRow[]>(data.rows);
  const [activeTab, setActiveTab] = useState<Tab>('ALL');
  const [month, setMonth] = useState<string>('ALL');
  const [page, setPage] = useState(0);
  const [showFixes, setShowFixes] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<RowPatch>({});

  const months = useMemo(() => [...new Set(rows.map(r => r.fecha.slice(0, 7)))].sort(), [rows]);

  const stats = useMemo(() => {
    const saving = rows.filter(willSave);
    return {
      total: rows.length,
      saving: saving.length,
      airPanama: rows.filter(r => r.aerolinea === 'Air Panama').length,
      copa: rows.filter(r => r.aerolinea === 'Copa Airlines').length,
      avisos: rows.filter(r => r.warnings.length > 0).length,
      omitidos: rows.length - saving.length,
      sinRuta: saving.filter(r => !r.ruta).length,
      pax: saving.reduce((s, r) => s + r.pasajeros, 0),
    };
  }, [rows]);

  const filtered = useMemo(() => rows.filter(r => {
    if (month !== 'ALL' && !r.fecha.startsWith(month)) return false;
    if (activeTab === 'AVISOS') return r.warnings.length > 0;
    if (activeTab === 'OMITIDOS') return !willSave(r);
    if (activeTab !== 'ALL') return r.aerolinea === activeTab;
    return true;
  }), [rows, activeTab, month]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount - 1);
  const visible = filtered.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);

  const changeView = (update: () => void) => { update(); setPage(0); setEditingId(null); };

  const toggleIncluir = (id: string) =>
    setRows(prev => withDuplicates(prev.map(r => r.id === id ? { ...r, incluir: !r.incluir } : r)));

  const startEdit = (r: ImportRow) => {
    setEditingId(r.id);
    setEditForm({ fecha: r.fecha, numero_vuelo: r.numero_vuelo, ruta: r.ruta, pasajeros: r.pasajeros });
  };

  const saveEdit = () => {
    if (!editingId) return;
    setRows(prev => withDuplicates(prev.map(r => r.id === editingId ? applyEdit(r, editForm) : r)));
    setEditingId(null);
  };

  const sheetCount = data.sheets.filter(s => s.rows > 0).length;
  const fixes = Object.entries(data.fixes).sort((a, b) => b[1] - a[1]);
  const utcSheets = data.sheets.filter(s => s.utc && s.rows > 0).map(s => s.name);
  const tabs: { id: Tab; label: string; count: number; tone?: string }[] = [
    { id: 'ALL', label: 'Todos', count: stats.total },
    { id: 'Air Panama', label: 'Air Panama', count: stats.airPanama },
    { id: 'Copa Airlines', label: 'Copa Airlines', count: stats.copa },
    { id: 'AVISOS', label: 'Con avisos', count: stats.avisos, tone: 'text-amber-600' },
    { id: 'OMITIDOS', label: 'Omitidos', count: stats.omitidos, tone: 'text-slate-500' },
  ];
  const inputCls = "h-8 px-2 border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent";

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-2 md:p-4 bg-[#0A192F]/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-7xl bg-white rounded-2xl shadow-2xl flex flex-col max-h-[94vh] overflow-hidden">

        {/* Header */}
        <div className="flex items-start justify-between gap-3 p-4 md:p-6 border-b border-slate-100">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-10 h-10 shrink-0 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <span className="material-symbols-outlined text-[20px]">preview</span>
            </div>
            <div className="min-w-0">
              <h2 className="font-headline-sm text-lg font-bold text-slate-800">Vista previa de importación</h2>
              <p className="text-sm text-slate-500">
                {stats.total} vuelos de Air Panama y Copa en {sheetCount} {sheetCount === 1 ? 'pestaña' : 'pestañas'}. Solo se guarda la fecha, sin horas.
              </p>
            </div>
          </div>
          <button
            onClick={onCancel}
            aria-label="Cerrar"
            className="w-8 h-8 shrink-0 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Correcciones aplicadas */}
        <div className="px-4 md:px-6 py-3 border-b border-slate-100 bg-emerald-50/50 text-sm">
          <button onClick={() => setShowFixes(v => !v)} className="flex items-center gap-2 font-semibold text-emerald-800">
            <span className="material-symbols-outlined text-[18px]">auto_fix_high</span>
            Correcciones automáticas ({fixes.reduce((s, [, n]) => s + n, 0)})
            <span className="material-symbols-outlined text-[18px]">{showFixes ? 'expand_less' : 'expand_more'}</span>
          </button>
          {showFixes && (
            <ul className="mt-2 grid gap-1 md:grid-cols-2 text-emerald-900/80">
              {fixes.map(([label, n]) => <li key={label}>• {label}: <strong>{n}</strong></li>)}
              {utcSheets.length > 0 && <li>• Pestañas en hora UTC (fecha ajustada a Panamá): {utcSheets.join(', ')}</li>}
            </ul>
          )}
        </div>

        {/* Tabs + filtro de mes */}
        <div className="px-4 md:px-6 pt-3 border-b border-slate-100 flex flex-wrap items-end justify-between gap-3">
          <div className="flex gap-5 overflow-x-auto scrollbar-hide">
            {tabs.map(t => (
              <button
                key={t.id}
                onClick={() => changeView(() => setActiveTab(t.id))}
                className={`pb-3 font-semibold text-sm whitespace-nowrap transition-colors border-b-2 ${activeTab === t.id ? 'border-primary text-primary' : `border-transparent ${t.tone ?? 'text-slate-500'} hover:text-slate-700`}`}
              >
                {t.label} ({t.count})
              </button>
            ))}
          </div>
          <select
            value={month}
            onChange={e => changeView(() => setMonth(e.target.value))}
            className="mb-2 h-9 px-3 rounded-lg border border-slate-200 text-sm text-slate-700 bg-white"
            aria-label="Filtrar por mes"
          >
            <option value="ALL">Todos los meses</option>
            {months.map(m => (
              <option key={m} value={m}>
                {new Date(`${m}-15T12:00:00`).toLocaleDateString('es-PA', { month: 'long', year: 'numeric' })}
              </option>
            ))}
          </select>
        </div>

        {/* Tabla */}
        <div className="flex-1 overflow-auto bg-slate-50/50 p-3 md:p-6">
          <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto shadow-sm">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[12px]">
                <tr>
                  <th className="px-3 py-3 text-center" title="Incluir en la importación">✓</th>
                  <th className="px-3 py-3">Fecha</th>
                  <th className="px-3 py-3">Aerolínea</th>
                  <th className="px-3 py-3">Vuelo</th>
                  <th className="px-3 py-3 text-center">Tipo</th>
                  <th className="px-3 py-3">Ruta</th>
                  <th className="px-3 py-3">Avión</th>
                  <th className="px-3 py-3 text-right">PAX</th>
                  <th className="px-3 py-3 text-center">Editar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {visible.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-slate-500">No hay vuelos para mostrar con este filtro.</td>
                  </tr>
                ) : visible.map(r => {
                  const isEditing = editingId === r.id;
                  const saving = willSave(r);
                  return (
                    <tr
                      key={r.id}
                      className={`transition-colors ${saving ? 'hover:bg-slate-50' : 'bg-slate-50/80 text-slate-400'}`}
                      onKeyDown={isEditing ? e => {
                        if (e.key === 'Enter') { e.preventDefault(); saveEdit(); }
                        if (e.key === 'Escape') setEditingId(null);
                      } : undefined}
                    >
                      <td className="px-3 py-2 text-center">
                        {/* Un duplicado no se puede marcar: ya se guarda la otra fila del mismo vuelo */}
                        <input
                          type="checkbox"
                          checked={r.incluir && !r.duplicadoDe}
                          disabled={!!r.duplicadoDe}
                          onChange={() => toggleIncluir(r.id)}
                          aria-label={`Incluir ${r.numero_vuelo} del ${r.fecha}`}
                          title={r.duplicadoDe ? `Repetido: ya se guarda la ${r.duplicadoDe}` : undefined}
                          className="w-4 h-4 accent-primary disabled:cursor-not-allowed disabled:opacity-40"
                        />
                      </td>
                      <td className="px-3 py-2 font-medium">
                        {isEditing ? (
                          <input type="date" className={`${inputCls} w-36`} value={editForm.fecha ?? ''} onChange={e => setEditForm({ ...editForm, fecha: e.target.value })} />
                        ) : r.fecha}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <div className={`w-5 h-5 rounded-full flex items-center justify-center text-white text-[11px] font-bold ${r.aerolinea === 'Copa Airlines' ? 'bg-[#00529b]' : 'bg-[#002f6c]'}`}>
                            {r.aerolinea === 'Copa Airlines' ? 'CM' : '7P'}
                          </div>
                          {r.aerolinea}
                        </div>
                      </td>
                      <td className="px-3 py-2 font-semibold">
                        {isEditing ? (
                          <input className={`${inputCls} w-28 uppercase`} value={editForm.numero_vuelo ?? ''} onChange={e => setEditForm({ ...editForm, numero_vuelo: e.target.value })} />
                        ) : (
                          <span className="inline-flex items-center gap-1">
                            {r.numero_vuelo}
                            {(r.warnings.length > 0 || r.duplicadoDe) && (
                              <span
                                className={`material-symbols-outlined text-[16px] cursor-help ${r.duplicadoDe ? 'text-slate-400' : 'text-amber-500'}`}
                                title={[r.duplicadoDe && `Duplicado: se conserva la ${r.duplicadoDe}`, ...r.warnings].filter(Boolean).join('\n')}
                              >
                                {r.duplicadoDe ? 'content_copy' : 'warning'}
                              </span>
                            )}
                          </span>
                        )}
                        {r.duplicadoDe && !isEditing && (
                          <span className="block text-[11px] font-normal text-slate-400">Repetido · se guarda la {r.duplicadoDe}</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-center">
                        {r.tipo === 'llegada' ? (
                          <span className="inline-flex items-center gap-1 text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md text-[12px] font-bold"><span className="material-symbols-outlined text-[14px]">flight_land</span> Llegada</span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md text-[12px] font-bold"><span className="material-symbols-outlined text-[14px]">flight_takeoff</span> Salida</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-slate-500">
                        {isEditing ? (
                          <RouteSelect
                            value={editForm.ruta ?? ''}
                            onChange={ruta => setEditForm({ ...editForm, ruta })}
                            label={r.tipo === 'llegada' ? 'Aeropuerto de origen (de dónde viene)' : 'Aeropuerto de destino (a dónde va)'}
                            className={inputCls}
                          />
                        ) : r.tipo === 'llegada' ? `${r.ruta || '???'} → DAV` : `DAV → ${r.ruta || '???'}`}
                      </td>
                      <td className="px-3 py-2 text-slate-500">
                        <span className="font-semibold text-slate-700">{r.avion ?? '—'}</span>
                        {r.matricula && <span className="text-[12px]"> · {r.matricula}</span>}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {isEditing ? (
                          <input type="number" min={0} className={`${inputCls} w-20 text-right`} value={editForm.pasajeros ?? 0} onChange={e => setEditForm({ ...editForm, pasajeros: Math.max(0, parseInt(e.target.value) || 0) })} />
                        ) : <span className="font-bold">{r.pasajeros}</span>}
                        <span className="text-slate-400 font-normal"> / {r.capacidad}</span>
                      </td>
                      <td className="px-3 py-2 text-center">
                        {isEditing ? (
                          <div className="flex items-center justify-center gap-2">
                            <button onClick={saveEdit} className="text-emerald-600 hover:text-emerald-700" title="Aplicar">
                              <span className="material-symbols-outlined text-[20px]">check_circle</span>
                            </button>
                            <button onClick={() => setEditingId(null)} className="text-slate-400 hover:text-slate-600" title="Cancelar">
                              <span className="material-symbols-outlined text-[20px]">cancel</span>
                            </button>
                          </div>
                        ) : (
                          <button onClick={() => startEdit(r)} className="text-primary hover:text-primary/80 transition-colors" title="Editar">
                            <span className="material-symbols-outlined text-[18px]">edit</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {pageCount > 1 && (
            <div className="flex items-center justify-center gap-3 pt-4 text-sm text-slate-600">
              <button disabled={currentPage === 0} onClick={() => { setPage(currentPage - 1); setEditingId(null); }} className="px-3 h-9 rounded-lg border border-slate-200 bg-white disabled:opacity-40">Anterior</button>
              <span>Página {currentPage + 1} de {pageCount}</span>
              <button disabled={currentPage >= pageCount - 1} onClick={() => { setPage(currentPage + 1); setEditingId(null); }} className="px-3 h-9 rounded-lg border border-slate-200 bg-white disabled:opacity-40">Siguiente</button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 md:p-6 border-t border-slate-100 bg-white flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="text-sm text-slate-500">
            {stats.sinRuta > 0 ? (
              <button onClick={() => changeView(() => { setActiveTab('AVISOS'); setMonth('ALL'); })} className="text-rose-600 font-semibold underline underline-offset-2">
                {stats.sinRuta} {stats.sinRuta === 1 ? 'vuelo no tiene' : 'vuelos no tienen'} origen/destino: complétalos o exclúyelos para continuar
              </button>
            ) : (
              <>Se guardarán <strong>{stats.saving}</strong> vuelos ({stats.pax.toLocaleString('es-PA')} pasajeros). {stats.omitidos > 0 && <>{stats.omitidos} omitidos.</>}</>
            )}
          </div>
          <div className="flex gap-3 justify-end">
            <button onClick={onCancel} className="px-5 h-11 rounded-xl font-bold text-slate-600 hover:bg-slate-100 transition-colors">
              Cancelar
            </button>
            <button
              onClick={() => onConfirm(rows.filter(willSave))}
              disabled={stats.saving === 0 || stats.sinRuta > 0 || editingId !== null}
              className="px-6 h-11 rounded-xl font-bold bg-primary text-white hover:bg-primary/90 transition-colors shadow-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span className="material-symbols-outlined text-[18px]">cloud_upload</span>
              Confirmar importación
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}

// Aeropuerto del otro extremo del vuelo: lista de los conocidos, o un código a mano con "Otro…"
function RouteSelect({ value, onChange, label, className }: {
  value: string;
  onChange: (ruta: string) => void;
  label: string;
  className: string;
}) {
  const code = value.trim().toUpperCase();
  const listed = AIRPORTS.some(a => a.code === code);
  const [custom, setCustom] = useState(code !== '' && !listed);
  const empty = code === '';
  const cls = `${className} ${empty ? 'border-rose-400 bg-rose-50' : ''}`;

  if (custom) {
    return (
      <div className="flex items-center gap-1">
        <input
          autoFocus
          maxLength={4}
          aria-label={label}
          title={label}
          placeholder="Código"
          value={value}
          onChange={e => onChange(e.target.value.toUpperCase())}
          className={`${cls} w-20 uppercase`}
        />
        <button type="button" onClick={() => { setCustom(false); onChange(''); }} className="text-slate-400 hover:text-slate-600" title="Volver a la lista">
          <span className="material-symbols-outlined text-[18px]">list</span>
        </button>
      </div>
    );
  }

  return (
    <select
      autoFocus={empty}
      aria-label={label}
      title={label}
      value={listed ? code : ''}
      onChange={e => {
        if (e.target.value === '__otro') { setCustom(true); onChange(''); }
        else onChange(e.target.value);
      }}
      className={`${cls} w-44 bg-white`}
    >
      <option value="" disabled>Elegir aeropuerto…</option>
      {AIRPORTS.map(a => (
        <option key={a.code} value={a.code}>{a.name ? `${a.code} · ${a.name}` : a.code}</option>
      ))}
      <option value="__otro">Otro código…</option>
    </select>
  );
}
