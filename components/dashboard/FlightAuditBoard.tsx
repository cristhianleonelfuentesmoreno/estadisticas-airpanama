"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { getUpcomingFlights, FlightData } from "@/app/actions/flights";
import { archiveFlight, updateFlightDetails } from "@/app/actions/manualFlights";

export function FlightAuditBoard({ isAdmin }: { isAdmin: boolean }) {
  const [flights, setFlights] = useState<FlightData[]>([]);
  const [loading, setLoading] = useState(true);

  // We fetch all flights to see which ones are ARRIBO or CANCELADO but NOT archived.
  const todayPanama = new Date().toLocaleString("en-US", { timeZone: "America/Panama" });
  const todayStr = new Date(todayPanama).toISOString().split('T')[0];
  const [boardDate, setBoardDate] = useState<string>(todayStr);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await getUpcomingFlights(boardDate);
      // Filtramos solo los vuelos que llegaron o fueron cancelados, y que NO están archivados
      const pendingAudit = data.filter(f => 
        (f.status === 'ARRIBO' || f.status === 'CANCELADO') && !f.isArchived
      );
      setFlights(pendingAudit);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      loadData();
    }
  }, [isAdmin, boardDate]);

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

  if (!isAdmin) return null;
  if (!loading && flights.length === 0) return null;

  return (
    <div className="mt-space-lg flex flex-col gap-space-sm font-sans mb-8">
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-error">fact_check</span>
          <h2 className="font-headline-sm text-headline-sm font-bold text-on-surface">Auditoría de Vuelos Pendientes de Cierre</h2>
          <span className="bg-error text-white text-xs font-bold px-2 py-0.5 rounded-full">{flights.length}</span>
        </div>
        <div className="flex items-center gap-2">
          <input 
            type="date" 
            value={boardDate} 
            onChange={(e) => setBoardDate(e.target.value)}
            className="text-xs px-2 py-1 bg-surface-container rounded-md border border-white/5"
          />
        </div>
      </div>

      <div className="bg-surface-container-lowest rounded-2xl border border-error/20 p-4 shadow-sm overflow-x-auto">
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
              {flights.map(flight => (
                <tr key={flight.id} className="hover:bg-surface-container-highest transition-colors">
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
                    <button 
                      onClick={() => handleArchive(flight.id, flight.manualLogId)}
                      className="px-4 py-1.5 bg-secondary text-on-secondary hover:bg-secondary/90 transition-colors rounded-md text-xs font-bold shadow-sm flex items-center justify-center gap-1 ml-auto"
                    >
                      <span className="material-symbols-outlined text-[16px]">inventory_2</span>
                      Archivar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
