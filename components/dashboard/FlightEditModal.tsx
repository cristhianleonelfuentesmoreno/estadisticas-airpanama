import { useState } from "react";
import { toast } from "sonner";
import { FlightData } from "@/app/actions/flights";
import { updateFlightDetails, deleteManualFlight } from "@/app/actions/manualFlights";

export function FlightEditModal({
  flight,
  onClose,
  onSuccess
}: {
  flight: FlightData;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    flight_number: flight.flightNumber.replace(/^(CM-|7P-)/, ''), // Remove prefix if any
    origin: flight.origin,
    destination: flight.destination,
    departure_time_local: flight.departureTimeLocal,
    arrival_time_local: flight.arrivalTimeLocal,
    actual_departure_time: flight.actualDeparture || flight.departureTimeLocal,
    actual_arrival_time: flight.actualArrival || flight.arrivalTimeLocal,
    aircraft: flight.aircraft,
    aircraft_reg: flight.aircraftReg,
    pilot: flight.pilot || '',
    pax_count: flight.paxCount,
    pax_max: flight.paxMax
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'pax_count' || name === 'pax_max' ? parseInt(value) || 0 : value
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
      await updateFlightDetails(flight.manualLogId, formData);
      toast.success("Vuelo actualizado con éxito");
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Error al actualizar");
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
      } catch (err: any) {
        toast.error("Error al eliminar el vuelo: " + err.message);
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
              <input name="departure_time_local" type="time" value={formData.departure_time_local} onChange={handleChange} required className="h-10 px-3 rounded-md bg-surface-container-low border border-outline-variant/30 text-on-surface font-medium focus:outline-none focus:border-primary" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="font-label-sm text-label-sm text-on-surface-variant uppercase">Llegada Estimada</span>
              <input name="arrival_time_local" type="time" value={formData.arrival_time_local} onChange={handleChange} required className="h-10 px-3 rounded-md bg-surface-container-low border border-outline-variant/30 text-on-surface font-medium focus:outline-none focus:border-primary" />
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
              <input name="aircraft_reg" value={formData.aircraft_reg} onChange={handleChange} required className="h-10 px-3 rounded-md bg-surface-container-low border border-outline-variant/30 text-on-surface font-medium focus:outline-none focus:border-primary" />
            </label>
          </div>

          <div className="grid grid-cols-2 gap-space-sm">
            <label className="flex flex-col gap-1">
              <span className="font-label-sm text-label-sm text-on-surface-variant uppercase">Pax Bordo</span>
              <input name="pax_count" type="number" value={formData.pax_count} onChange={handleChange} required className="h-10 px-3 rounded-md bg-surface-container-low border border-outline-variant/30 text-on-surface font-medium focus:outline-none focus:border-primary" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="font-label-sm text-label-sm text-on-surface-variant uppercase">Capacidad Máx</span>
              <input name="pax_max" type="number" value={formData.pax_max} onChange={handleChange} required className="h-10 px-3 rounded-md bg-surface-container-low border border-outline-variant/30 text-on-surface font-medium focus:outline-none focus:border-primary" />
            </label>
          </div>

          <label className="flex flex-col gap-1">
            <span className="font-label-sm text-label-sm text-on-surface-variant uppercase">Piloto</span>
            <input name="pilot" value={formData.pilot} onChange={handleChange} className="h-10 px-3 rounded-md bg-surface-container-low border border-outline-variant/30 text-on-surface font-medium focus:outline-none focus:border-primary" />
          </label>

          <div className="flex items-center gap-space-sm pt-space-md mt-2 border-t border-surface-container">
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
