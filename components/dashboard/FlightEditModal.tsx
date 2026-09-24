import { useState } from "react";
import { toast } from "sonner";
import { FlightData } from "@/app/actions/flights";
import { updateFlightDetails, deleteManualFlight } from "@/app/actions/manualFlights";

export function FlightEditModal({
  flight,
  canDelete = false,
  onClose,
  onSuccess
}: {
  flight: FlightData;
  canDelete?: boolean; // borrar del itinerario: supervisores y administrador
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const formatTimeForInput = (timeStr?: string) => {
    if (!timeStr) return '';
    const match = timeStr.match(/(\d{1,2}):(\d{2})/);
    if (match) {
      return `${match[1].padStart(2, '0')}:${match[2]}`;
    }
    return timeStr;
  };

  const [formData, setFormData] = useState({
    flightNumber: flight.flightNumber.replace(/^(CM-|7P-)/, ''), // Remove prefix if any
    origin: flight.origin || '',
    destination: flight.destination || '',
    departureTimeLocal: formatTimeForInput(flight.departureTimeLocal),
    arrivalTimeLocal: formatTimeForInput(flight.arrivalTimeLocal),
    actual_departure_time: formatTimeForInput(flight.actualDepartureTime || flight.departureTimeLocal),
    actual_arrival_time: formatTimeForInput(flight.actualArrivalTime || flight.arrivalTimeLocal),
    aircraft: flight.aircraft || '',
    aircraftReg: flight.aircraftReg || '',
    pilot: flight.pilot || '',
    paxCount: flight.paxCount,
    paxMax: flight.paxMax
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'paxCount' || name === 'paxMax' ? parseInt(value) || 0 : value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!flight.manualLogId) {
      toast.error("Vuelo no se puede editar (Falta ID)");
      return;
    }

    setLoading(true);
    try {
      const payload = {
        ...formData,
        actual_departure_time: formData.actual_departure_time || formData.departureTimeLocal,
        actual_arrival_time: formData.actual_arrival_time || formData.arrivalTimeLocal,
      };
      await updateFlightDetails(flight.manualLogId, payload);
      toast.success("Vuelo actualizado con éxito");
      onSuccess();
      onClose();
    } catch (err) {
      toast.error((err as Error).message || "Error al actualizar");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!flight.manualLogId) return;
    if (confirm("¿Estás seguro de que deseas eliminar este vuelo por completo? Esta acción no se puede deshacer.")) {
      setLoading(true);
      try {
        await deleteManualFlight(flight.manualLogId);
        toast.success("Vuelo eliminado correctamente");
        onSuccess();
        onClose();
      } catch (err) {
        toast.error("Error al eliminar el vuelo: " + (err as Error).message);
        setLoading(false);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-primary/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-surface-container-lowest rounded-2xl shadow-xl flex flex-col animate-in zoom-in-95 duration-200">
        
        <div className="flex items-center justify-between p-space-md border-b border-surface-container">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center text-on-secondary">
              <span className="material-symbols-outlined text-[18px]">edit_document</span>
            </div>
            <h2 className="font-headline-sm text-headline-sm font-bold text-on-surface">Editar Vuelo {flight.flightNumber}</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-on-surface-variant hover:bg-surface-container transition-colors">
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-space-md flex flex-col gap-space-sm overflow-y-auto max-h-[70vh]">
          
          <div className="grid grid-cols-2 gap-space-sm">
            <label className="flex flex-col gap-1">
              <span className="font-label-sm text-label-sm text-on-surface-variant uppercase">Origen</span>
              <input name="origin" value={formData.origin} onChange={handleChange} required className="h-10 px-3 rounded-md bg-surface-container-low border border-outline-variant/30 text-on-surface font-medium focus:outline-none focus:border-primary" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="font-label-sm text-label-sm text-on-surface-variant uppercase">Destino</span>
              <input name="destination" value={formData.destination} onChange={handleChange} required className="h-10 px-3 rounded-md bg-surface-container-low border border-outline-variant/30 text-on-surface font-medium focus:outline-none focus:border-primary" />
            </label>
          </div>

          <div className="grid grid-cols-2 gap-space-sm">
            <label className="flex flex-col gap-1">
              <span className="font-label-sm text-label-sm text-on-surface-variant uppercase">Salida Estimada</span>
              <input name="departureTimeLocal" type="time" value={formData.departureTimeLocal} onChange={handleChange} required className="h-10 px-3 rounded-md bg-surface-container-low border border-outline-variant/30 text-on-surface font-medium focus:outline-none focus:border-primary" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="font-label-sm text-label-sm text-on-surface-variant uppercase">Llegada Estimada</span>
              <input name="arrivalTimeLocal" type="time" value={formData.arrivalTimeLocal} onChange={handleChange} required className="h-10 px-3 rounded-md bg-surface-container-low border border-outline-variant/30 text-on-surface font-medium focus:outline-none focus:border-primary" />
            </label>
          </div>

          <div className="grid grid-cols-2 gap-space-sm">
            <label className="flex flex-col gap-1">
              <span className="font-label-sm text-label-sm text-on-surface-variant uppercase">Salida Real</span>
              <input name="actual_departure_time" type="time" value={formData.actual_departure_time} onChange={handleChange} required className="h-10 px-3 rounded-md bg-surface-container-low border border-outline-variant/30 text-on-surface font-medium focus:outline-none focus:border-primary" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="font-label-sm text-label-sm text-on-surface-variant uppercase">Llegada Real</span>
              <input name="actual_arrival_time" type="time" value={formData.actual_arrival_time} onChange={handleChange} required className="h-10 px-3 rounded-md bg-surface-container-low border border-outline-variant/30 text-on-surface font-medium focus:outline-none focus:border-primary" />
            </label>
          </div>

          <div className="grid grid-cols-2 gap-space-sm">
            <label className="flex flex-col gap-1">
              <span className="font-label-sm text-label-sm text-on-surface-variant uppercase">Tipo Aeronave</span>
              <input name="aircraft" value={formData.aircraft} onChange={handleChange} required className="h-10 px-3 rounded-md bg-surface-container-low border border-outline-variant/30 text-on-surface font-medium focus:outline-none focus:border-primary" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="font-label-sm text-label-sm text-on-surface-variant uppercase">Matrícula</span>
              <input name="aircraftReg" value={formData.aircraftReg} onChange={handleChange} required className="h-10 px-3 rounded-md bg-surface-container-low border border-outline-variant/30 text-on-surface font-medium focus:outline-none focus:border-primary" />
            </label>
          </div>

          <div className="grid grid-cols-2 gap-space-sm">
            <label className="flex flex-col gap-1">
              <span className="font-label-sm text-label-sm text-on-surface-variant uppercase">Pax Bordo</span>
              <input name="paxCount" type="number" value={formData.paxCount} onChange={handleChange} required className="h-10 px-3 rounded-md bg-surface-container-low border border-outline-variant/30 text-on-surface font-medium focus:outline-none focus:border-primary" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="font-label-sm text-label-sm text-on-surface-variant uppercase">Capacidad Máx</span>
              <input name="paxMax" type="number" value={formData.paxMax} onChange={handleChange} required className="h-10 px-3 rounded-md bg-surface-container-low border border-outline-variant/30 text-on-surface font-medium focus:outline-none focus:border-primary" />
            </label>
          </div>

          <label className="flex flex-col gap-1">
            <span className="font-label-sm text-label-sm text-on-surface-variant uppercase">Piloto</span>
            <input name="pilot" value={formData.pilot} onChange={handleChange} className="h-10 px-3 rounded-md bg-surface-container-low border border-outline-variant/30 text-on-surface font-medium focus:outline-none focus:border-primary" />
          </label>

          <div className="flex items-center gap-space-sm pt-space-md mt-2 border-t border-surface-container">
{canDelete && (
            <button 
              type="button" 
              disabled={loading} 
              onClick={handleDelete} 
              className="px-4 h-11 rounded-lg bg-error/10 text-error font-label-md font-bold hover:bg-error/20 transition-colors flex items-center justify-center gap-1"
              title="Eliminar Vuelo"
            >
              <span className="material-symbols-outlined text-[18px]">delete</span>
              Eliminar
            </button>
            )}
            <button type="button" disabled={loading} onClick={onClose} className="flex-1 h-11 rounded-lg bg-surface-container text-on-surface font-label-md font-bold hover:bg-surface-container-high transition-colors">
              Cancelar
            </button>
            <button type="submit" disabled={loading} className="flex-1 h-11 rounded-lg bg-secondary text-on-secondary font-label-md font-bold hover:bg-secondary/90 transition-colors shadow-sm">
              {loading ? 'Enviando...' : 'Enviar'}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}
