"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { getUpcomingFlights, FlightData } from "@/app/actions/flights";
import { archiveFlight, updateFlightDetails, deleteManualFlight } from "@/app/actions/manualFlights";
import { FlightEditModal } from "./FlightEditModal";

export function FlightAuditBoard({ initialDate, onClose }: { initialDate: string; onClose: () => void }) {
  const [flights, setFlights] = useState<FlightData[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingFlight, setEditingFlight] = useState<FlightData | null>(null);
  const [isApprovingAll, setIsApprovingAll] = useState(false);
  const [confirmAllModalOpen, setConfirmAllModalOpen] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [isDeletingAll, setIsDeletingAll] = useState(false);
  const [confirmDeleteAllModalOpen, setConfirmDeleteAllModalOpen] = useState(false);

  const [boardDate, setBoardDate] = useState<string>('TODOS');
  const [activeTab, setActiveTab] = useState<'ALL' | 'Air Panama' | 'Copa Airlines'>('ALL');

  const filteredFlights = flights.filter(f => activeTab === 'ALL' || f.airline === activeTab);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await getUpcomingFlights(boardDate);
      // Filtramos solo los vuelos que llegaron o fueron cancelados, y que NO están archivados
      const pendingAudit = data.filter(f => 
        (f.origin === 'DAV' || f.destination === 'DAV') &&
        (f.status === 'ARRIBÓ' || f.status === 'CANCELADO') && !f.isArchived
      );
      setFlights(pendingAudit);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [boardDate]);

  const handleArchive = async (id: string, manualLogId?: string) => {
    if (!manualLogId) {
      toast.error("Vuelo no tiene ID manual");
      return;
    }
    try {
      await archiveFlight(manualLogId);
      toast.success("Vuelo archivado correctamente en el histórico");
      loadData();
    } catch (err: any) {
      toast.error("Error al archivar: " + err.message);
    }
  };

  const handleUpdatePax = async (manualLogId: string, paxCount: number) => {
    try {
      await updateFlightDetails(manualLogId, { paxCount });
      toast.success("Pasajeros actualizados");
      loadData();
    } catch (err: any) {
      toast.error("Error al actualizar pax: " + err.message);
    }
  };

  const handleApproveAll = () => {
    if (filteredFlights.length === 0) return;
    setConfirmAllModalOpen(true);
  };

  const executeApproveAll = async () => {
    setIsApprovingAll(true);
    setConfirmAllModalOpen(false);
    try {
      const promises = filteredFlights
        .filter(f => f.manualLogId)
        .map(f => archiveFlight(f.manualLogId!));
      await Promise.all(promises);
      toast.success(`${filteredFlights.length} vuelos archivados correctamente`);
      loadData();
    } catch (err: any) {
      toast.error("Error al archivar múltiples vuelos: " + err.message);
    } finally {
      setIsApprovingAll(false);
    }
  };

  const handleDelete = (manualLogId?: string) => {
    if (!manualLogId) return;
    setConfirmDeleteId(manualLogId);
  };

  const executeDelete = async () => {
    if (!confirmDeleteId) return;
    try {
      await deleteManualFlight(confirmDeleteId);
      toast.success("Vuelo eliminado correctamente");
      loadData();
    } catch (err: any) {
      toast.error("Error al eliminar el vuelo: " + err.message);
    } finally {
      setConfirmDeleteId(null);
    }
  };

  const handleDeleteAll = () => {
    if (filteredFlights.length === 0) return;
    setConfirmDeleteAllModalOpen(true);
  };

  const executeDeleteAll = async () => {
    setIsDeletingAll(true);
    setConfirmDeleteAllModalOpen(false);
    try {
      const promises = filteredFlights
        .filter(f => f.manualLogId)
        .map(f => deleteManualFlight(f.manualLogId!));
      await Promise.all(promises);
      toast.success(`${filteredFlights.length} vuelos descartados correctamente`);
      loadData();
    } catch (err: any) {
      toast.error("Error al descartar múltiples vuelos: " + err.message);
    } finally {
      setIsDeletingAll(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-surface w-full max-w-6xl rounded-[2rem] shadow-2xl flex flex-col max-h-[90vh] overflow-hidden border border-outline-variant/30 relative">
        {/* Header with Close Button */}
        <div className="absolute top-4 right-4 z-10">
          <button 
            onClick={onClose}
            className="p-2 rounded-full bg-surface-container hover:bg-surface-container-high transition-colors text-on-surface-variant"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="p-6 border-b border-outline-variant/50 bg-surface-container-lowest flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center border border-blue-200 shadow-inner">
              <span className="material-symbols-outlined text-blue-600 text-[20px]">fact_check</span>
            </div>
            <div>
              <h2 className="text-xl font-headline-md font-bold text-on-surface flex items-center gap-2">
                Auditoría de Vuelos Pendientes de Cierre
                <span className="bg-error text-white text-xs px-2 py-0.5 rounded-full shadow-sm">{flights.length}</span>
              </h2>
              <p className="text-sm text-on-surface-variant mt-0.5">Revisa y aprueba los vuelos que ya han llegado o sido cancelados antes de guardarlos en el histórico definitivo.</p>
            </div>
          </div>
          <div className="flex items-center gap-4 mr-12">
            {filteredFlights.length > 0 && (
              <>
                <button 
                  onClick={handleDeleteAll}
                  disabled={isDeletingAll || isApprovingAll || loading}
                  className="px-4 py-1.5 rounded-lg text-sm font-bold bg-error/10 text-error hover:bg-error/20 transition-colors flex items-center gap-2 disabled:opacity-50"
                  title="Descartar todos los vuelos visibles"
                >
                  {isDeletingAll ? (
                    <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
                  ) : (
                    <span className="material-symbols-outlined text-[18px]">delete_sweep</span>
                  )}
                  Descartar Todos
                </button>
                <button 
                  onClick={handleApproveAll}
                  disabled={isApprovingAll || isDeletingAll || loading}
                  className="px-4 py-1.5 rounded-lg text-sm font-bold bg-emerald-600 text-white shadow-sm hover:bg-emerald-500 transition-colors flex items-center gap-2 disabled:opacity-50"
                  title="Aprobar todos los vuelos visibles"
                >
                  {isApprovingAll ? (
                    <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
                  ) : (
                    <span className="material-symbols-outlined text-[18px]">done_all</span>
                  )}
                  Aprobar Todos
                </button>
              </>
            )}
            <div className="h-6 w-px bg-outline-variant/30 hidden sm:block"></div>
            <button 
              onClick={() => setBoardDate('TODOS')}
              className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-colors shadow-sm ${boardDate === 'TODOS' ? 'bg-primary text-on-primary border border-primary' : 'bg-surface-container-low text-on-surface-variant border border-outline-variant/50 hover:bg-surface-container'}`}
            >
              TODOS
            </button>
            <div className={`flex items-center px-3 py-1.5 rounded-lg border transition-colors ${boardDate !== 'TODOS' ? 'bg-surface-container border-outline-variant/70' : 'bg-surface-container-low border-outline-variant/50'}`}>
              <input 
                type="date"
                value={boardDate === 'TODOS' ? '' : boardDate}
                onChange={(e) => setBoardDate(e.target.value)}
                className="bg-transparent border-none outline-none font-label-sm text-on-surface font-medium focus:ring-0 cursor-pointer p-0 w-[115px]"
              />
            </div>
          </div>
        </div>

        <div className="p-6 overflow-y-auto flex-1 bg-surface-container-lowest">
          <div className="flex gap-6 mb-4 px-2 border-b border-outline-variant/30">
            <button
              onClick={() => setActiveTab('ALL')}
              className={`pb-3 font-semibold text-sm transition-colors border-b-2 ${activeTab === 'ALL' ? 'border-primary text-primary' : 'border-transparent text-on-surface-variant hover:text-on-surface'}`}
            >
              Todos ({flights.length})
            </button>
            {flights.some(f => f.airline === 'Air Panama') && (
              <button
                onClick={() => setActiveTab('Air Panama')}
                className={`pb-3 font-semibold text-sm transition-colors border-b-2 ${activeTab === 'Air Panama' ? 'border-primary text-primary' : 'border-transparent text-on-surface-variant hover:text-on-surface'}`}
              >
                Air Panama ({flights.filter(f => f.airline === 'Air Panama').length})
              </button>
            )}
            {flights.some(f => f.airline === 'Copa Airlines') && (
              <button
                onClick={() => setActiveTab('Copa Airlines')}
                className={`pb-3 font-semibold text-sm transition-colors border-b-2 ${activeTab === 'Copa Airlines' ? 'border-primary text-primary' : 'border-transparent text-on-surface-variant hover:text-on-surface'}`}
              >
                Copa Airlines ({flights.filter(f => f.airline === 'Copa Airlines').length})
              </button>
            )}
          </div>
          <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/40 p-4 shadow-sm overflow-x-auto">
            {loading ? (
              <div className="text-center py-4 text-on-surface-variant animate-pulse">Cargando vuelos por auditar...</div>
            ) : (
              <table className="w-full text-left text-sm min-w-[700px]">
                <thead className="text-on-surface-variant font-label-sm uppercase border-b border-outline-variant/30">
                  <tr>
                    <th className="pb-2 font-bold">Vuelo / Fecha</th>
                    <th className="pb-2 font-bold">Ruta</th>
                    <th className="pb-2 font-bold">Estado Final</th>
                    <th className="pb-2 font-bold">T. Real Salida/Llegada</th>
                    <th className="pb-2 font-bold">Pasajeros (PAX)</th>
                    <th className="pb-2 font-bold text-right">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/20">
                  {filteredFlights.map((flight, idx) => (
                    <tr key={flight.manualLogId || `${flight.id}-${idx}`} className="hover:bg-surface-container-highest transition-colors">
                      <td className="py-3">
                        <div className="font-bold text-on-surface">{flight.flightNumber}</div>
                        <div className="text-xs text-on-surface-variant">{boardDate}</div>
                      </td>
                      <td className="py-3 text-on-surface-variant">
                        {flight.origin} → {flight.destination}
                      </td>
                      <td className="py-3">
                        <span className={`px-2 py-1 rounded text-xs font-bold ${flight.status === 'CANCELADO' ? 'bg-error/10 text-error' : 'bg-surface-container-high text-on-surface'}`}>
                          {flight.status}
                        </span>
                      </td>
                      <td className="py-3 text-xs text-on-surface-variant">
                        Salida: {flight.actualDepartureTime || flight.departureTimeLocal} <br/>
                        Llegada: {flight.actualArrivalTime || flight.arrivalTimeLocal}
                      </td>
                      <td className="py-3">
                        <div className="flex items-center gap-1">
                          <input 
                            type="number" 
                            defaultValue={flight.paxCount}
                            onBlur={(e) => {
                              const newPax = parseInt(e.target.value, 10);
                              if (!isNaN(newPax) && newPax !== flight.paxCount && flight.manualLogId) {
                                handleUpdatePax(flight.manualLogId, newPax);
                              }
                            }}
                            className="w-16 bg-surface-container rounded border border-outline-variant/30 focus:border-primary text-center text-sm py-1"
                          />
                          <span className="text-xs text-on-surface-variant">/ {flight.paxMax}</span>
                        </div>
                      </td>
                      <td className="py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button 
                            onClick={() => setEditingFlight(flight)}
                            className="px-3 py-1.5 bg-surface-container hover:bg-surface-container-high text-on-surface-variant rounded-md text-xs font-bold transition-colors flex items-center gap-1"
                            title="Editar"
                          >
                            <span className="material-symbols-outlined text-[16px]">edit</span>
                            Editar
                          </button>
                          <button 
                            onClick={() => handleDelete(flight.manualLogId)}
                            className="px-3 py-1.5 bg-error/10 hover:bg-error/20 text-error rounded-md text-xs font-bold transition-colors flex items-center gap-1"
                            title="Descartar"
                          >
                            <span className="material-symbols-outlined text-[16px]">delete</span>
                            Descartar
                          </button>
                          <button 
                            onClick={() => handleArchive(flight.id, flight.manualLogId)}
                            className="px-3 py-1.5 bg-emerald-600 text-white hover:bg-emerald-500 transition-colors rounded-md text-xs font-bold shadow-sm flex items-center gap-1"
                          >
                            <span className="material-symbols-outlined text-[16px]">check_circle</span>
                            Aprobado
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {!loading && filteredFlights.length === 0 && (
              <div className="text-center py-12 text-on-surface-variant">
                <span className="material-symbols-outlined text-4xl mb-2 opacity-50">check_circle</span>
                <p>No hay vuelos pendientes de auditar para la vista seleccionada.</p>
              </div>
            )}
          </div>
        </div>

        {editingFlight && (
          <FlightEditModal 
            flight={editingFlight}
            onClose={() => setEditingFlight(null)}
            onSuccess={() => {
              loadData();
            }}
          />
        )}

        {/* Custom Confirmation Modal for Approve All */}
        {confirmAllModalOpen && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-surface w-full max-w-sm rounded-[2rem] shadow-2xl overflow-hidden border border-outline-variant/30 animate-in zoom-in-95 duration-200">
              <div className="p-6 text-center flex flex-col items-center">
                <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4 bg-primary/10">
                  <span className="material-symbols-outlined text-4xl text-primary">done_all</span>
                </div>
                <h3 className="text-xl font-headline-md font-bold text-on-surface mb-2">Aprobar Todos</h3>
                <p className="text-sm font-body-sm text-on-surface-variant">
                  ¿Estás seguro de que deseas aprobar y archivar los {filteredFlights.length} vuelos pendientes que se muestran?
                </p>
              </div>
              <div className="flex bg-surface-container-low border-t border-black/5 p-4 gap-3">
                <button 
                  onClick={() => setConfirmAllModalOpen(false)}
                  className="flex-1 px-4 py-2 rounded-xl font-label-md font-semibold text-on-surface-variant hover:bg-surface-container transition-colors shadow-sm"
                >
                  Cancelar
                </button>
                <button 
                  onClick={executeApproveAll}
                  className="flex-1 px-4 py-2 rounded-xl font-label-md font-semibold bg-emerald-600 text-white hover:bg-emerald-700 transition-colors shadow-sm"
                >
                  Aprobar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Custom Confirmation Modal for Delete */}
        {confirmDeleteId && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-surface w-full max-w-sm rounded-[2rem] shadow-2xl overflow-hidden border border-error/20 animate-in zoom-in-95 duration-200">
              <div className="p-6 text-center flex flex-col items-center">
                <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4 bg-error/10">
                  <span className="material-symbols-outlined text-4xl text-error">warning</span>
                </div>
                <h3 className="text-xl font-headline-md font-bold text-on-surface mb-2">Eliminar Vuelo</h3>
                <p className="text-sm font-body-sm text-on-surface-variant">
                  ¿Estás seguro de que deseas eliminar este vuelo? Esta acción no se puede deshacer.
                </p>
              </div>
              <div className="flex bg-surface-container-low border-t border-black/5 p-4 gap-3">
                <button 
                  onClick={() => setConfirmDeleteId(null)}
                  className="flex-1 px-4 py-2 rounded-xl font-label-md font-semibold text-on-surface-variant hover:bg-surface-container transition-colors shadow-sm"
                >
                  Cancelar
                </button>
                <button 
                  onClick={executeDelete}
                  className="flex-1 px-4 py-2 rounded-xl font-label-md font-semibold bg-error text-on-error hover:bg-error/90 transition-colors shadow-sm"
                >
                  Eliminar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Custom Confirmation Modal for Delete All */}
        {confirmDeleteAllModalOpen && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-surface w-full max-w-sm rounded-[2rem] shadow-2xl overflow-hidden border border-error/20 animate-in zoom-in-95 duration-200">
              <div className="p-6 text-center flex flex-col items-center">
                <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4 bg-error/10">
                  <span className="material-symbols-outlined text-4xl text-error">delete_sweep</span>
                </div>
                <h3 className="text-xl font-headline-md font-bold text-on-surface mb-2">Descartar Todos</h3>
                <p className="text-sm font-body-sm text-on-surface-variant">
                  ¿Estás seguro de que deseas eliminar permanentemente los {filteredFlights.length} vuelos mostrados?
                </p>
              </div>
              <div className="flex bg-surface-container-low border-t border-black/5 p-4 gap-3">
                <button 
                  onClick={() => setConfirmDeleteAllModalOpen(false)}
                  className="flex-1 px-4 py-2 rounded-xl font-label-md font-semibold text-on-surface-variant hover:bg-surface-container transition-colors shadow-sm"
                >
                  Cancelar
                </button>
                <button 
                  onClick={executeDeleteAll}
                  className="flex-1 px-4 py-2 rounded-xl font-label-md font-semibold bg-error text-on-error hover:bg-error/90 transition-colors shadow-sm"
                >
                  Descartar Todos
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
