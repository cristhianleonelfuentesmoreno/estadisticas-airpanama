import { useState, useMemo } from "react";

export interface ParsedFlight {
  id?: string; // used internally for keys
  fecha: string;
  aerolinea: string;
  numero_vuelo: string;
  origen?: string;
  destino?: string;
  hora_itinerario: string;
  hora_itinerario_llegada?: string;
  hora_real_llegada?: string;
  hora_itinerario_salida?: string;
  hora_real_salida?: string;
  estado_final: string;
  pasajeros_abordo: number;
  capacidad_total: number;
  avion?: string;
  matricula?: string;
  type: 'llegada' | 'salida';
}

export function ExcelImportPreviewModal({
  data,
  onConfirm,
  onCancel
}: {
  data: { llegadas: any[]; salidas: any[] };
  onConfirm: (data: { llegadas: any[]; salidas: any[] }) => void;
  onCancel: () => void;
}) {
  const [activeTab, setActiveTab] = useState<'ALL' | 'Air Panama' | 'Copa Airlines'>('ALL');
  const [loading, setLoading] = useState(false);

  // Unify and add internal IDs for editing
  const [flights, setFlights] = useState<ParsedFlight[]>(() => {
    let combined: ParsedFlight[] = [];
    data.llegadas.forEach((f, i) => {
      combined.push({ ...f, id: `arr_${i}`, type: 'llegada' });
    });
    data.salidas.forEach((f, i) => {
      combined.push({ ...f, id: `dep_${i}`, type: 'salida' });
    });
    return combined;
  });

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<ParsedFlight>>({});

  const filteredFlights = useMemo(() => {
    if (activeTab === 'ALL') return flights;
    return flights.filter(f => f.aerolinea === activeTab);
  }, [flights, activeTab]);

  const stats = useMemo(() => {
    return {
      total: flights.length,
      airPanama: flights.filter(f => f.aerolinea === 'Air Panama').length,
      copa: flights.filter(f => f.aerolinea === 'Copa Airlines').length
    };
  }, [flights]);

  const handleEditClick = (flight: ParsedFlight) => {
    setEditingId(flight.id!);
    setEditForm({ ...flight });
  };

  const handleSaveEdit = () => {
    if (!editingId) return;
    setFlights(prev => prev.map(f => f.id === editingId ? { ...f, ...editForm } as ParsedFlight : f));
    setEditingId(null);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
  };

  const handleConfirm = () => {
    setLoading(true);
    // Split back into llegadas and salidas, removing internal 'id' and 'type'
    const llegadasToInsert = flights.filter(f => f.type === 'llegada').map(({ id, type, ...rest }) => rest);
    const salidasToInsert = flights.filter(f => f.type === 'salida').map(({ id, type, ...rest }) => rest);
    
    onConfirm({ llegadas: llegadasToInsert, salidas: salidasToInsert });
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-[#0A192F]/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-6xl bg-white rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <span className="material-symbols-outlined text-[20px]">preview</span>
            </div>
            <div>
              <h2 className="font-headline-sm text-lg font-bold text-slate-800">Vista Previa de Importación</h2>
              <p className="text-sm text-slate-500">Revisa y edita los datos antes de guardarlos en la base de datos.</p>
            </div>
          </div>
          <button 
            onClick={onCancel}
            disabled={loading}
            className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Tabs */}
        <div className="px-6 pt-4 border-b border-slate-100 flex gap-6">
          <button
            onClick={() => setActiveTab('ALL')}
            className={`pb-3 font-semibold text-sm transition-colors border-b-2 ${activeTab === 'ALL' ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
          >
            Todos ({stats.total})
          </button>
          {stats.airPanama > 0 && (
            <button
              onClick={() => setActiveTab('Air Panama')}
              className={`pb-3 font-semibold text-sm transition-colors border-b-2 ${activeTab === 'Air Panama' ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
            >
              Air Panama ({stats.airPanama})
            </button>
          )}
          {stats.copa > 0 && (
            <button
              onClick={() => setActiveTab('Copa Airlines')}
              className={`pb-3 font-semibold text-sm transition-colors border-b-2 ${activeTab === 'Copa Airlines' ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
            >
              Copa Airlines ({stats.copa})
            </button>
          )}
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto bg-slate-50/50 p-6">
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[12px]">
                <tr>
                  <th className="px-4 py-3">Fecha</th>
                  <th className="px-4 py-3">Aerolínea</th>
                  <th className="px-4 py-3">Vuelo</th>
                  <th className="px-4 py-3 text-center">Tipo</th>
                  <th className="px-4 py-3">Ruta</th>
                  <th className="px-4 py-3 text-center">T. Prog/Real</th>
                  <th className="px-4 py-3 text-right">Pasajeros (PAX)</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredFlights.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                      No hay vuelos para mostrar en esta pestaña.
                    </td>
                  </tr>
                ) : filteredFlights.map(f => {
                  const isEditing = editingId === f.id;
                  return (
                    <tr key={f.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 font-medium">{f.fecha}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {f.aerolinea === 'Copa Airlines' ? (
                            <div className="w-5 h-5 rounded-full bg-[#00529b] flex items-center justify-center text-white text-[11px] font-bold">CM</div>
                          ) : f.aerolinea === 'Air Panama' ? (
                            <div className="w-5 h-5 rounded-full bg-[#002f6c] flex items-center justify-center text-white text-[11px] font-bold">7P</div>
                          ) : null}
                          {f.aerolinea}
                        </div>
                      </td>
                      <td className="px-4 py-3 font-semibold">{f.numero_vuelo}</td>
                      <td className="px-4 py-3 text-center">
                        {f.type === 'llegada' ? (
                          <span className="inline-flex items-center gap-1 text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md text-[12px] font-bold"><span className="material-symbols-outlined text-[14px]">flight_land</span> Llegada</span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md text-[12px] font-bold"><span className="material-symbols-outlined text-[14px]">flight_takeoff</span> Salida</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-500">
                        {f.type === 'llegada' ? `${f.origen || 'PAC'} → DAV` : `DAV → ${f.destino || 'PAC'}`}
                      </td>
                      <td className="px-4 py-3 text-center text-xs text-slate-500">
                        <div className="flex flex-col gap-0.5">
                          <span>
                            <span className="font-semibold text-slate-400">Prog:</span>{' '}
                            {new Date(f.type === 'llegada' ? f.hora_itinerario_llegada || f.hora_itinerario : f.hora_itinerario_salida || f.hora_itinerario).toLocaleTimeString('es-PA', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/Panama' })}
                          </span>
                          <span>
                            <span className="font-semibold text-slate-600">Real:</span>{' '}
                            {new Date(f.type === 'llegada' ? f.hora_real_llegada || f.hora_itinerario : f.hora_real_salida || f.hora_itinerario).toLocaleTimeString('es-PA', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/Panama' })}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {isEditing ? (
                          <input 
                            type="number" 
                            className="w-16 h-8 px-2 text-right border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                            value={editForm.pasajeros_abordo}
                            onChange={(e) => setEditForm({ ...editForm, pasajeros_abordo: parseInt(e.target.value) || 0 })}
                          />
                        ) : (
                          <span className="font-bold">{f.pasajeros_abordo}</span>
                        )}
                        <span className="text-slate-400 font-normal"> / {f.capacidad_total}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[12px] font-bold ${
                          f.estado_final === 'LLEGÓ' ? 'bg-emerald-100 text-emerald-700' : 
                          f.estado_final === 'DESPEGÓ' ? 'bg-blue-100 text-blue-700' :
                          f.estado_final === 'DEMORADO' ? 'bg-amber-100 text-amber-700' : 
                          f.estado_final === 'CANCELADO' ? 'bg-rose-100 text-rose-700' : 
                          'bg-slate-100 text-slate-700'
                        }`}>
                          {f.estado_final}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {isEditing ? (
                          <div className="flex items-center justify-center gap-2">
                            <button onClick={handleSaveEdit} className="text-emerald-600 hover:text-emerald-700" title="Guardar">
                              <span className="material-symbols-outlined text-[20px]">check_circle</span>
                            </button>
                            <button onClick={handleCancelEdit} className="text-slate-400 hover:text-slate-600" title="Cancelar">
                              <span className="material-symbols-outlined text-[20px]">cancel</span>
                            </button>
                          </div>
                        ) : (
                          <button onClick={() => handleEditClick(f)} className="text-primary hover:text-primary/80 transition-colors">
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
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-100 bg-white flex items-center justify-between">
          <div className="text-sm text-slate-500">
            Revisando <strong>{filteredFlights.length}</strong> vuelos de {stats.total} en total.
          </div>
          <div className="flex gap-3">
            <button
              onClick={onCancel}
              disabled={loading}
              className="px-5 h-11 rounded-xl font-bold text-slate-600 hover:bg-slate-100 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleConfirm}
              disabled={loading}
              className="px-6 h-11 rounded-xl font-bold bg-primary text-white hover:bg-primary/90 transition-colors shadow-sm flex items-center gap-2"
            >
              {loading ? (
                <>
                  <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
                  Guardando...
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[18px]">cloud_upload</span>
                  Confirmar Importación
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
