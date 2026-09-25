"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { addMultipleManualFlights, getManualFormKnowledge, type FrequentFlight, type KnownAircraft } from "@/app/actions/manualFlights";
import { addHistoricoFlight } from "@/app/actions/flights";
import { AIRPORTS, airportLabel } from "@/lib/airports";
import { capacityOf, routeMinutes, type FleetKnowledge } from "@/lib/fleet/rules";
import { estimatedArrival, reviewWarnings } from "@/lib/ocr/review";

// Ingreso manual guiado: se elige en vez de escribir. Dos usos:
//  - "itinerario": vuelo del día en Próximos Vuelos (con tripulación)
//  - "registro": vuelo ya realizado, directo al Registro Histórico (llegada/salida en David,
//    hora real y estado final; el histórico no guarda tripulación)
// Un vuelo regular completa ruta,
// horario y avión; una matrícula completa modelo y capacidad; la tripulación se elige
// por rol. Todo sale de la base de conocimiento y del histórico.

type Airline = "Air Panama" | "Copa Airlines";
type Knowledge = { kb: FleetKnowledge; frequentFlights: FrequentFlight[]; aircraft: KnownAircraft[] };

const BRAND: Record<Airline, { prefix: string; color: string; soft: string }> = {
  "Air Panama": { prefix: "7P", color: "#dc2626", soft: "#fef2f2" },
  "Copa Airlines": { prefix: "CM", color: "#0032A0", soft: "#eef2ff" },
};

const todayPanama = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Panama" });

function Step({ n, title, hint, children }: { n: number; title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center gap-2.5">
        <span className="w-6 h-6 shrink-0 rounded-full bg-slate-900 text-white text-[12px] font-bold flex items-center justify-center">{n}</span>
        <h3 className="text-[15px] font-bold text-slate-800">{title}</h3>
        {hint && <span className="text-[12px] text-slate-500 truncate">· {hint}</span>}
      </div>
      <div className="pl-0 sm:pl-8">{children}</div>
    </section>
  );
}

function Chip({ active, onClick, children, title, color }: { active: boolean; onClick: () => void; children: React.ReactNode; title?: string; color?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`shrink-0 px-3 py-2 rounded-xl border text-left text-[13px] font-semibold transition-all active:scale-[0.97] ${active ? "text-white shadow-md border-transparent" : "bg-white border-slate-200 text-slate-700 hover:border-slate-400"}`}
      style={active ? { background: color ?? "#0f172a" } : undefined}
    >
      {children}
    </button>
  );
}

type Tipo = "llegada" | "salida";
const ESTADOS: { value: string; label: string; tone: string }[] = [
  { value: "LLEGÓ", label: "Llegó", tone: "#059669" },
  { value: "CUMPLIDO", label: "Cumplido", tone: "#059669" },
  { value: "DEMORADO", label: "Demorado", tone: "#d97706" },
  { value: "DESVIADO", label: "Desviado", tone: "#7c3aed" },
  { value: "CANCELADO", label: "Cancelado", tone: "#dc2626" },
];

export function ManualFlightForm({ onSaved, mode = "itinerario", defaultDate }: {
  onSaved: () => void;
  mode?: "itinerario" | "registro";
  defaultDate?: string;
}) {
  const isRegistro = mode === "registro";
  const [data, setData] = useState<Knowledge | null>(null);
  const [saving, setSaving] = useState(false);

  const [date, setDate] = useState(defaultDate || todayPanama());
  const [tipo, setTipo] = useState<Tipo>("llegada");
  const [realTime, setRealTime] = useState("");
  const [estado, setEstado] = useState("");
  const [airline, setAirline] = useState<Airline>("Air Panama");
  const [flightNumber, setFlightNumber] = useState("");
  const [origin, setOrigin] = useState("");
  // En registro arranca como llegada: David es el destino
  const [destination, setDestination] = useState(isRegistro ? "DAV" : "");
  const [departure, setDeparture] = useState("");
  const [arrival, setArrival] = useState("");
  const [arrivalTouched, setArrivalTouched] = useState(false);
  const [registration, setRegistration] = useState("");
  const [model, setModel] = useState("");
  const [paxMax, setPaxMax] = useState("");
  const [captain, setCaptain] = useState("");
  const [firstOfficer, setFirstOfficer] = useState("");
  const [cabin, setCabin] = useState<string[]>([]);
  const [pax, setPax] = useState("");

  useEffect(() => {
    getManualFormKnowledge().then(setData).catch(() => toast.error("No se pudo cargar la base de flota y tripulación"));
  }, []);

  const kb = data?.kb;
  const brand = BRAND[airline];
  const isAP = airline === "Air Panama";

  // Vuelos frecuentes: los regulares de la base (Air Panama) + los más vistos en el histórico
  const frequent = useMemo(() => {
    if (!data) return [];
    const list: { flightNumber: string; origin: string; destination: string; usual: string | null; code: string | null }[] = [];
    const seen = new Set<string>();
    for (const s of data.kb.scheduled.filter(s => s.airline === airline)) {
      const k = `${s.flightNumber}|${s.origin}|${s.destination}`;
      if (seen.has(k)) continue;
      seen.add(k);
      list.push({ flightNumber: s.flightNumber, origin: s.origin, destination: s.destination, usual: s.usualDeparture, code: s.code });
    }
    for (const f of data.frequentFlights.filter(f => f.airline === airline)) {
      const k = `${f.flightNumber}|${f.origin}|${f.destination}`;
      if (seen.has(k)) continue;
      seen.add(k);
      list.push({ flightNumber: f.flightNumber, origin: f.origin, destination: f.destination, usual: null, code: null });
    }
    // Primero los que tocan David, ordenados por número
    return list
      .filter(f => f.origin === "DAV" || f.destination === "DAV")
      .sort((a, b) => Number(a.flightNumber) - Number(b.flightNumber))
      .slice(0, 24);
  }, [data, airline]);

  const fleet = useMemo(() => (data?.aircraft ?? []).filter(a => a.airline === airline), [data, airline]);
  const types = useMemo(() => (kb?.types ?? []).filter(t => t.airline === airline), [kb, airline]);
  const captains = (kb?.crew ?? []).filter(c => c.role === "capitan").map(c => c.name).sort();
  const officers = (kb?.crew ?? []).filter(c => c.role === "primer_oficial").map(c => c.name).sort();
  const cabinCrew = (kb?.crew ?? []).filter(c => c.role === "cabina").map(c => c.name).sort();
  const noCabin = model === "C-208";
  const minutes = kb && origin && destination ? routeMinutes(airline, origin, destination, kb, model) : null;

  // Llegada automática (salida + duración de la ruta para ese modelo) mientras no se escriba a mano
  const recalcArrival = (dep: string, ori: string, des: string, aircraft: string = model) => {
    if (arrivalTouched || !kb) return;
    setArrival(dep ? estimatedArrival({ airline, origin: ori, destination: des, departureTimeLocal: dep, aircraft }, kb) : "");
  };

  const chooseTipo = (t: Tipo) => {
    if (t === tipo) return;
    const other = tipo === "llegada" ? origin : destination;
    setTipo(t);
    const ori = t === "llegada" ? (other === "DAV" ? "" : other) : "DAV";
    const des = t === "llegada" ? "DAV" : (other === "DAV" ? "" : other);
    setOrigin(ori);
    setDestination(des);
    recalcArrival(departure, ori, des);
  };
  const setOtherAirport = (code: string) => {
    const ori = tipo === "llegada" ? code : "DAV";
    const des = tipo === "llegada" ? "DAV" : code;
    setOrigin(ori);
    setDestination(des);
    recalcArrival(departure, ori, des);
  };

  const chooseAirline = (a: Airline) => {
    if (a === airline) return;
    setAirline(a);
    setFlightNumber(""); setOrigin(isRegistro && tipo === "salida" ? "DAV" : ""); setDestination(isRegistro && tipo === "llegada" ? "DAV" : "");
    setDeparture(""); setArrival(""); setArrivalTouched(false); setRealTime("");
    setRegistration(""); setModel(""); setPaxMax(""); setCaptain(""); setFirstOfficer(""); setCabin([]);
  };

  const pickFlight = (f: (typeof frequent)[number]) => {
    if (isRegistro) setTipo(f.destination === "DAV" ? "llegada" : "salida");
    setFlightNumber(f.flightNumber);
    setOrigin(f.origin);
    setDestination(f.destination);
    if (f.usual) setDeparture(f.usual);
    setArrivalTouched(false);
    if (kb) setArrival(f.usual ? estimatedArrival({ airline, origin: f.origin, destination: f.destination, departureTimeLocal: f.usual, aircraft: model || f.code }, kb) : "");
    if (f.code && !model) { setModel(f.code); setPaxMax(String(capacityOf(f.code, kb!) ?? "")); }
  };

  const pickAircraft = (a: KnownAircraft) => {
    setRegistration(a.registration);
    if (a.code) { setModel(a.code); recalcArrival(departure, origin, destination, a.code); }
    if (a.paxMax) setPaxMax(String(a.paxMax));
    if (a.code === "C-208") setCabin([]);
  };

  const pickModel = (code: string) => {
    setModel(code);
    recalcArrival(departure, origin, destination, code);
    const cap = kb ? capacityOf(code, kb) : null;
    if (cap) setPaxMax(String(cap));
    if (code === "C-208") setCabin([]);
  };

  const onRegistrationTyped = (value: string) => {
    const reg = value.toUpperCase().trim();
    setRegistration(reg);
    const normalized = reg.replace(/^HP-?(\d{3,4}).*$/, "HP-$1");
    const known = fleet.find(a => a.registration === normalized);
    if (known) pickAircraft(known);
  };

  const pilotLine = [captain, firstOfficer].filter(Boolean).join(" / ");
  const paxNum = pax === "" ? undefined : Math.max(0, parseInt(pax, 10) || 0);
  const capNum = paxMax === "" ? 0 : Math.max(0, parseInt(paxMax, 10) || 0);
  const occupancy = capNum > 0 && paxNum != null ? Math.round((paxNum / capNum) * 100) : null;

  const draft = {
    flightNumber, airline, origin, destination, departureTimeLocal: departure, arrivalTimeLocal: arrival,
    aircraft: model, aircraftReg: registration, pilot: pilotLine, cabin_crew: cabin.join(" / "),
    paxCount: paxNum ?? null, paxMax: capNum || null,
  };
  const warnings = kb ? reviewWarnings(draft, kb).filter(w => !w.startsWith("Hora no leída")) : [];
  const estadoFinal = estado || (tipo === "llegada" ? "LLEGÓ" : "CUMPLIDO");
  const cancelled = estadoFinal === "CANCELADO";
  const missing = (isRegistro
    ? [
        !flightNumber && "número de vuelo",
        (!origin || !destination) && (tipo === "llegada" ? "de dónde viene" : "a dónde va"),
        !cancelled && tipo === "llegada" && !arrival && !realTime && "hora de llegada",
        !cancelled && tipo === "salida" && !departure && !realTime && "hora de salida",
      ]
    : [
        !flightNumber && "número de vuelo",
        (!origin || !destination) && "ruta",
        !departure && "hora de salida",
        !arrival && "hora de llegada",
      ]
  ).filter(Boolean) as string[];
  const blocking = missing.length > 0 || (origin !== "" && origin === destination) || (occupancy != null && paxNum! > capNum);

  const save = async () => {
    if (blocking) return;
    setSaving(true);
    try {
      if (isRegistro) {
        const res = await addHistoricoFlight({
          tipo,
          fecha: date,
          aerolinea: airline,
          numero_vuelo: flightNumber.trim(),
          ruta: tipo === "llegada" ? origin : destination,
          salida_programada: departure || undefined,
          llegada_programada: arrival || undefined,
          hora_real: realTime || undefined,
          estado_final: estadoFinal,
          pasajeros: paxNum ?? 0,
          capacidad: capNum,
          matricula: registration || undefined,
          avion: model || undefined,
        });
        if (!res.success) throw new Error(res.error);
        toast.success(`${brand.prefix}-${flightNumber} agregado al Registro del ${date}`);
        setFlightNumber(""); setDeparture(""); setArrival(""); setArrivalTouched(false); setRealTime(""); setEstado("");
        setRegistration(""); setModel(""); setPaxMax(""); setPax("");
        setOrigin(tipo === "salida" ? "DAV" : ""); setDestination(tipo === "llegada" ? "DAV" : "");
        onSaved();
        return;
      }
      await addMultipleManualFlights([{
        flightNumber: flightNumber.trim(),
        airline,
        origin, originName: "",
        destination, destinationName: "",
        departureTimeLocal: departure,
        arrivalTimeLocal: arrival,
        aircraft: model || "Desconocido",
        aircraftReg: registration,
        pilot: pilotLine,
        cabin_crew: cabin.length ? cabin.join(" / ") : undefined,
        paxCount: paxNum ?? 0,
        paxMax: capNum,
        flightDate: date,
      }]);
      toast.success(`${brand.prefix}-${flightNumber} agregado al itinerario del ${date}`);
      // Se conservan fecha y aerolínea para cargar el siguiente rápido
      setFlightNumber(""); setOrigin(""); setDestination(""); setDeparture(""); setArrival(""); setArrivalTouched(false);
      setRegistration(""); setModel(""); setPaxMax(""); setPax(""); setCabin([]);
      onSaved();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const field = "h-11 px-3 rounded-xl bg-white border border-slate-200 text-slate-800 text-[15px] font-semibold focus:outline-none focus:ring-2 focus:ring-slate-900/15 focus:border-slate-400 w-full min-w-0";
  const caption = "text-[11px] font-bold uppercase tracking-wider text-slate-500";

  if (!data) {
    return <p className="py-16 text-center text-slate-500 animate-pulse">Cargando flota y tripulación…</p>;
  }

  return (
    <div className="flex flex-col gap-7">
      {/* 1. Aerolínea y fecha */}
      <Step n={1} title="Aerolínea y fecha">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="grid grid-cols-2 gap-2 flex-1">
            {(Object.keys(BRAND) as Airline[]).map(a => (
              <button
                key={a}
                type="button"
                onClick={() => chooseAirline(a)}
                className={`h-12 rounded-xl border-2 font-bold text-[14px] flex items-center justify-center gap-2 transition-all ${airline === a ? "text-white shadow-md" : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"}`}
                style={airline === a ? { background: BRAND[a].color, borderColor: BRAND[a].color } : undefined}
              >
                <span className={`w-6 h-6 rounded-md text-[10px] font-black flex items-center justify-center ${airline === a ? "bg-white/20" : "text-white"}`} style={airline === a ? undefined : { background: BRAND[a].color }}>
                  {BRAND[a].prefix}
                </span>
                {a}
              </button>
            ))}
          </div>
          <input type="date" aria-label="Fecha del vuelo" value={date} onChange={e => setDate(e.target.value)} className={`${field} sm:w-44`} />
        </div>
      </Step>

      {/* 2. Vuelo */}
      <Step n={2} title="Vuelo" hint={frequent.length ? "toca uno frecuente y se completa la ruta" : undefined}>
        {frequent.length > 0 && (
          <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1 mb-3">
            {frequent.map(f => (
              <Chip
                key={`${f.flightNumber}-${f.origin}-${f.destination}`}
                active={flightNumber === f.flightNumber && origin === f.origin && destination === f.destination}
                onClick={() => pickFlight(f)}
                color={brand.color}
              >
                <span className="block text-[14px] font-black">{brand.prefix}-{f.flightNumber}</span>
                <span className="block text-[11px] opacity-80">{f.origin} → {f.destination}{f.usual ? ` · ${f.usual}` : ""}</span>
              </Chip>
            ))}
          </div>
        )}
        <label className="flex flex-col gap-1 max-w-[220px]">
          <span className={caption}>Número{frequent.length ? " (u otro)" : ""}</span>
          <div className="flex items-center rounded-xl border border-slate-200 bg-white overflow-hidden focus-within:ring-2 focus-within:ring-slate-900/15">
            <span className="px-3 h-11 flex items-center text-[15px] font-black text-white" style={{ background: brand.color }}>{brand.prefix}</span>
            <input
              inputMode="numeric"
              value={flightNumber}
              onChange={e => setFlightNumber(e.target.value.replace(/[^0-9A-Za-z-]/g, "").toUpperCase())}
              placeholder={isAP ? "670" : "17"}
              className="h-11 px-3 flex-1 min-w-0 text-[15px] font-bold text-slate-800 focus:outline-none"
            />
          </div>
        </label>
      </Step>

      {/* 3. Ruta y horario */}
      <Step n={3} title="Ruta y horario" hint={minutes ? `duración de la ruta: ${minutes} min` : undefined}>
        {isRegistro ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="grid grid-cols-2 gap-2">
              {(["llegada", "salida"] as Tipo[]).map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => chooseTipo(t)}
                  className={`h-11 rounded-xl border-2 font-bold text-[14px] flex items-center justify-center gap-1.5 transition-all ${tipo === t ? "text-white shadow-md" : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"}`}
                  style={tipo === t ? { background: brand.color, borderColor: brand.color } : undefined}
                >
                  <span className="material-symbols-outlined text-[18px]">{t === "llegada" ? "flight_land" : "flight_takeoff"}</span>
                  {t === "llegada" ? "Llegó a David" : "Salió de David"}
                </button>
              ))}
            </div>
            <label className="flex flex-col gap-1 min-w-0">
              <span className={caption}>{tipo === "llegada" ? "Viene de" : "Va a"}</span>
              <select value={tipo === "llegada" ? origin : destination} onChange={e => setOtherAirport(e.target.value)} className={field}>
                <option value="">Elegir…</option>
                {AIRPORTS.filter(a => a.code !== "DAV").map(a => <option key={a.code} value={a.code}>{airportLabel(a.code)}</option>)}
              </select>
            </label>
          </div>
        ) : (
        <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
          <label className="flex flex-col gap-1 min-w-0">
            <span className={caption}>Origen</span>
            <select value={origin} onChange={e => { setOrigin(e.target.value); recalcArrival(departure, e.target.value, destination); }} className={field}>
              <option value="">Elegir…</option>
              {AIRPORTS.map(a => <option key={a.code} value={a.code}>{airportLabel(a.code)}</option>)}
            </select>
          </label>
          <button
            type="button"
            onClick={() => { setOrigin(destination); setDestination(origin); recalcArrival(departure, destination, origin); }}
            className="h-11 w-11 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 flex items-center justify-center"
            title="Invertir ruta"
            aria-label="Invertir origen y destino"
          >
            <span className="material-symbols-outlined text-[20px]">swap_horiz</span>
          </button>
          <label className="flex flex-col gap-1 min-w-0">
            <span className={caption}>Destino</span>
            <select value={destination} onChange={e => { setDestination(e.target.value); recalcArrival(departure, origin, e.target.value); }} className={field}>
              <option value="">Elegir…</option>
              {AIRPORTS.map(a => <option key={a.code} value={a.code}>{airportLabel(a.code)}</option>)}
            </select>
          </label>
        </div>
        )}
        <div className="flex gap-2 mt-2">
          {!isRegistro && !origin && !destination && (
            <>
              <Chip active={false} onClick={() => setDestination("DAV")}>Llega a David</Chip>
              <Chip active={false} onClick={() => setOrigin("DAV")}>Sale de David</Chip>
            </>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3 mt-3">
          <label className="flex flex-col gap-1">
            <span className={caption}>{isRegistro ? "Salida programada" : "Salida"}</span>
            <input type="time" value={departure} onChange={e => { setDeparture(e.target.value); recalcArrival(e.target.value, origin, destination); }} className={field} />
          </label>
          <label className="flex flex-col gap-1">
            <span className={caption}>{isRegistro ? "Llegada programada" : "Llegada"}{!arrivalTouched && arrival ? " · calculada" : ""}</span>
            <input type="time" value={arrival} onChange={e => { setArrival(e.target.value); setArrivalTouched(true); }} className={field} />
          </label>
        </div>
        {isRegistro && (
          <label className="flex flex-col gap-1 mt-3 sm:max-w-[50%]">
            <span className={caption}>{tipo === "llegada" ? "Hora real de llegada a David" : "Hora real de salida de David"}</span>
            <input type="time" value={realTime} onChange={e => setRealTime(e.target.value)} className={field} />
            <span className="text-[12px] text-slate-500">Déjala vacía si fue a la hora programada.</span>
          </label>
        )}
      </Step>

      {/* 4. Avión */}
      <Step n={4} title="Avión" hint="la matrícula completa modelo y capacidad">
        {fleet.length > 0 && (
          <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1 mb-3">
            {fleet.slice(0, isAP ? 20 : 12).map(a => (
              <Chip key={a.registration} active={registration === a.registration} onClick={() => pickAircraft(a)} color={brand.color}>
                <span className="block text-[14px] font-black">{a.registration}</span>
                <span className="block text-[11px] opacity-80">{a.code || "?"}{a.paxMax ? ` · ${a.paxMax} asientos` : ""}</span>
              </Chip>
            ))}
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1">
            <span className={caption}>Matrícula{isAP ? "" : " (busca o escribe)"}</span>
            <input list="manual-form-regs" value={registration} onChange={e => onRegistrationTyped(e.target.value)} placeholder="HP-…" className={`${field} uppercase`} />
            <datalist id="manual-form-regs">
              {fleet.map(a => <option key={a.registration} value={a.registration}>{a.code}</option>)}
            </datalist>
          </label>
          <label className="flex flex-col gap-1">
            <span className={caption}>Capacidad</span>
            <input type="number" inputMode="numeric" min={0} value={paxMax} onChange={e => setPaxMax(e.target.value)} placeholder="Asientos" className={field} />
          </label>
        </div>
        <div className="flex flex-wrap gap-2 mt-3">
          {types.map(t => (
            <Chip key={t.code} active={model === t.code} onClick={() => pickModel(t.code)} title={t.name} color={brand.color}>
              {t.code}{t.paxMax ? <span className="opacity-70 font-normal"> · {t.paxMax}</span> : null}
            </Chip>
          ))}
        </div>
      </Step>

      {/* 5. Tripulación y pasajeros */}
      <Step n={5} title={isRegistro ? "Estado y pasajeros" : isAP ? "Tripulación y pasajeros" : "Pasajeros"}>
        {isRegistro && (
          <div className="flex flex-wrap gap-2 mb-4">
            {ESTADOS.filter(e => (tipo === "llegada" ? e.value !== "CUMPLIDO" : e.value !== "LLEGÓ")).map(e => (
              <Chip key={e.value} active={estadoFinal === e.value} onClick={() => setEstado(e.value)} color={e.tone}>
                {e.label}
              </Chip>
            ))}
          </div>
        )}
        {isAP && !isRegistro && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="flex flex-col gap-1">
                <span className={caption}>Capitán</span>
                <select value={captain} onChange={e => setCaptain(e.target.value)} className={field}>
                  <option value="">Elegir…</option>
                  {captains.map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className={caption}>Primer oficial</span>
                <select value={firstOfficer} onChange={e => setFirstOfficer(e.target.value)} className={field}>
                  <option value="">Elegir…</option>
                  {officers.map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </label>
            </div>
            <div className="mt-3">
              <span className={caption}>Cabina</span>
              {noCabin ? (
                <p className="text-[13px] text-slate-500 mt-1">La C-208 no lleva tripulación de cabina.</p>
              ) : (
                <div className="flex flex-wrap gap-2 mt-1.5">
                  {cabinCrew.map(n => (
                    <Chip key={n} active={cabin.includes(n)} onClick={() => setCabin(c => (c.includes(n) ? c.filter(x => x !== n) : [...c, n]))} color={brand.color}>
                      {cabin.includes(n) ? "✓ " : ""}{n}
                    </Chip>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
        <div className={`flex items-end gap-3 ${isAP && !isRegistro ? "mt-4" : ""}`}>
          <label className="flex flex-col gap-1 w-32">
            <span className={caption}>Pasajeros</span>
            <input type="number" inputMode="numeric" min={0} value={pax} onChange={e => setPax(e.target.value)} placeholder="0" className={field} />
          </label>
          <div className="flex-1 pb-1">
            <div className="flex justify-between text-[12px] font-semibold text-slate-500 mb-1">
              <span>Ocupación</span>
              <span className={occupancy != null && occupancy > 100 ? "text-red-600" : ""}>{occupancy != null ? `${occupancy}%` : "—"}{capNum ? ` de ${capNum}` : ""}</span>
            </div>
            <div className="h-2.5 rounded-full bg-slate-200 overflow-hidden">
              <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(occupancy ?? 0, 100)}%`, background: occupancy != null && occupancy > 100 ? "#dc2626" : brand.color }} />
            </div>
          </div>
        </div>
      </Step>

      {/* Resumen en vivo */}
      <div className="rounded-2xl border-2 p-4 flex flex-col gap-3" style={{ borderColor: `${brand.color}33`, background: brand.soft }}>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="text-[18px] font-black" style={{ color: brand.color }}>{brand.prefix}-{flightNumber || "…"}</span>
          <span className="text-[14px] font-bold text-slate-800">{origin || "?"} → {destination || "?"}</span>
          <span className="text-[14px] text-slate-600">{departure || "--:--"} – {arrival || "--:--"}{isRegistro && realTime ? ` · real ${realTime}` : ""}</span>
          {isRegistro && <span className="text-[12px] font-bold px-2 py-0.5 rounded-full bg-white border border-slate-200 text-slate-700">{ESTADOS.find(e => e.value === estadoFinal)?.label}</span>}
          <span className="text-[14px] text-slate-600">{model || "avión ?"}{registration ? ` · ${registration}` : ""}</span>
          <span className="text-[14px] text-slate-600">{paxNum ?? "?"}/{capNum || "?"} pax</span>
        </div>
        {isAP && !isRegistro && pilotLine && <p className="text-[13px] text-slate-600">{pilotLine}{cabin.length ? ` · Cabina: ${cabin.join(", ")}` : ""}</p>}
        {(missing.length > 0 || warnings.length > 0) && (
          <div className="flex flex-wrap gap-1.5">
            {missing.length > 0 && (
              <span className="text-[12px] font-semibold text-slate-700 bg-white border border-slate-200 px-2 py-0.5 rounded-full">Falta: {missing.join(", ")}</span>
            )}
            {warnings.map(w => (
              <span key={w} className="inline-flex items-center gap-1 text-[12px] font-medium text-amber-800 bg-amber-100 border border-amber-200 px-2 py-0.5 rounded-full">
                <span className="material-symbols-outlined text-[14px]">warning</span>{w}
              </span>
            ))}
          </div>
        )}
        <button
          type="button"
          onClick={save}
          disabled={blocking || saving}
          className="self-end h-11 px-6 rounded-xl font-bold text-white shadow-md flex items-center gap-2 disabled:opacity-40 disabled:shadow-none transition-all active:scale-[0.98]"
          style={{ background: brand.color }}
        >
          <span className={`material-symbols-outlined text-[20px] ${saving ? "animate-spin" : ""}`}>{saving ? "progress_activity" : "add"}</span>
          {saving ? "Agregando…" : isRegistro ? "Agregar al Registro" : "Agregar vuelo"}
        </button>
      </div>
    </div>
  );
}
