"use client";

import { Suspense, use, useEffect, useState } from "react";
import { FlightDecisionBoard } from "@/components/dashboard/FlightDecisionBoard";
import { FlightListBoard } from "@/components/dashboard/FlightListBoard";
import { getUpcomingFlights, type FlightData } from "@/app/actions/flights";
import type { FlightDecision } from "@/app/actions/weather";

type Props = {
  userName: string;
  userCargo: string;
  avatarUrl: string | null;
  isAdmin: boolean;
  today: string;
  flightsPromise: Promise<FlightData[]>;
  decisionsPromise: Promise<{ decisions: FlightDecision[]; fetchedAt: number }>;
};

// Vuelos de David (DAV), tanto los que llegan como los que salen
function davStats(flights: FlightData[]) {
  const dav = flights.filter(f => f.origin === "DAV" || f.destination === "DAV");
  return { vuelos: dav.length, pasajeros: dav.reduce((acc, f) => acc + (f.paxCount || 0), 0) };
}

export function DashboardHome({ userName, userCargo, avatarUrl, isAdmin, today, flightsPromise, decisionsPromise }: Props) {
  const [currentTime, setCurrentTime] = useState("");

  useEffect(() => {
    // Siempre en hora de Panamá, sin importar la zona horaria del dispositivo
    const updateTime = () => {
      const time = new Date().toLocaleTimeString("en-US", {
        timeZone: "America/Panama",
        hour: "numeric",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
      });
      setCurrentTime(`${time} Local`);
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <>
      <div className="flex flex-col w-full">
<div className="px-margin-mobile flex flex-col gap-space-md pt-space-md">
{/*  Welcome Greeting & Status Pill  */}
<div className="bg-primary-container text-on-primary rounded-xl p-space-md shadow-md relative overflow-hidden">
<div className="absolute -right-6 -bottom-6 w-32 h-32 bg-secondary-container/15 rounded-full blur-2xl pointer-events-none"></div>
<div className="flex items-center justify-between gap-space-sm relative z-10">
<div className="flex flex-col min-w-0 flex-1 pr-4">
<div className="flex items-center gap-space-xs">
<span className="inline-flex w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
<span className="font-label-sm text-label-sm text-on-primary-container tracking-wider uppercase">Turno Activo</span>
</div>
<h1 className="font-headline-md text-headline-md font-extrabold tracking-tight mt-0.5 capitalize truncate" title={userName}>{userName}</h1>
<p className="font-body-sm text-body-sm text-on-primary-container capitalize truncate" title={userCargo}>{userCargo}</p>
</div>
<div className="w-12 h-12 rounded-xl bg-surface-container-highest/20 flex items-center justify-center text-secondary-fixed ring-1 ring-white/20 overflow-hidden shadow-sm">
{avatarUrl ? (
  // eslint-disable-next-line @next/next/no-img-element
  <img src={avatarUrl} alt="Profile" className="w-full h-full object-cover" />
) : (
  <span className="font-headline-sm text-headline-sm font-bold text-white uppercase">{userName.charAt(0)}</span>
)}
</div>
</div>
<div className="mt-space-md pt-space-sm border-t border-white/10 flex items-center justify-between text-on-primary-container">
<span className="font-label-sm text-label-sm flex items-center gap-1">
<span className="material-symbols-outlined text-[15px] text-emerald-400">check_circle</span>
          Estación AirPanama Enrique Malek
        </span>
<span className="font-label-sm text-label-sm" suppressHydrationWarning>{currentTime}</span>
</div>
</div>

{/*  Executive KPI Grid  */}
<Suspense fallback={<KpiGrid vuelos={null} pasajeros={null} />}>
  <LiveKpis flightsPromise={flightsPromise} today={today} />
</Suspense>

{/*  Panel de Decisión de Vuelos (TAF)  */}
<div className="pt-space-xs">
  <Suspense fallback={<FlightDecisionBoard pending />}>
    <DecisionsFromServer decisionsPromise={decisionsPromise} />
  </Suspense>
</div>

{/*  Scheduled Flight Feed  */}
<div className="pt-space-xs pb-space-lg">
  <Suspense fallback={<FlightListBoard isAdmin={isAdmin} pending />}>
    <FlightListFromServer flightsPromise={flightsPromise} today={today} isAdmin={isAdmin} />
  </Suspense>
</div>
</div>
</div>

    </>
  );
}

function DecisionsFromServer({ decisionsPromise }: { decisionsPromise: Props["decisionsPromise"] }) {
  const initial = use(decisionsPromise);
  return <FlightDecisionBoard initial={initial} />;
}

function FlightListFromServer({ flightsPromise, today, isAdmin }: { flightsPromise: Props["flightsPromise"]; today: string; isAdmin: boolean }) {
  const flights = use(flightsPromise);
  return <FlightListBoard isAdmin={isAdmin} initial={{ date: today, flights }} />;
}

// Contadores: llegan con la página y se refrescan cada minuto
function LiveKpis({ flightsPromise, today }: { flightsPromise: Props["flightsPromise"]; today: string }) {
  const initial = use(flightsPromise);
  const [stats, setStats] = useState(() => davStats(initial));

  useEffect(() => {
    const interval = setInterval(() => {
      getUpcomingFlights(today)
        .then(flights => setStats(davStats(flights)))
        .catch(e => console.error("Error fetching metrics:", e));
    }, 60000);
    return () => clearInterval(interval);
  }, [today]);

  return <KpiGrid vuelos={stats.vuelos} pasajeros={stats.pasajeros} />;
}

function KpiGrid({ vuelos, pasajeros }: { vuelos: number | null; pasajeros: number | null }) {
  const value = (n: number | null) =>
    n === null ? <span className="inline-block w-10 h-8 rounded-md bg-surface-container animate-pulse align-middle" /> : n.toLocaleString();
  return (
<div className="grid grid-cols-1 md:grid-cols-2 gap-space-sm">
{/*  Vuelos Completados  */}
<div className="bg-surface-container-lowest p-space-md rounded-xl shadow-sm flex flex-col justify-between border border-surface-container/50">
<div className="flex items-center justify-between">
<span className="font-label-sm text-[12px] text-on-surface-variant uppercase font-bold tracking-wide">VUELOS AEROPUERTO INTERNACIONAL ENRIQUE MALEK</span>
<span className="w-7 h-7 rounded-lg bg-sky-100 flex items-center justify-center text-sky-700">
<span className="material-symbols-outlined text-[16px]">flight_land</span>
</span>
</div>
<div className="mt-space-xs">
<span className="font-display-hero text-headline-lg-mobile font-extrabold text-on-surface leading-none">{value(vuelos)}</span>
<span className="font-body-sm text-body-sm text-on-surface-variant block mt-1">Día en curso (Air Panama)</span>
</div>
</div>
{/*  Pax en Tránsito  */}
<div className="bg-surface-container-lowest p-space-md rounded-xl shadow-sm flex flex-col justify-between border border-surface-container/50">
<div className="flex items-center justify-between">
<span className="font-label-sm text-[12px] text-on-surface-variant uppercase font-bold tracking-wide">PASAJEROS TOTALES</span>
<span className="w-7 h-7 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-700">
<span className="material-symbols-outlined text-[16px]">groups</span>
</span>
</div>
<div className="mt-space-xs">
<span className="font-display-hero text-headline-lg-mobile font-extrabold text-on-surface leading-none">{value(pasajeros)}</span>
<span className="font-body-sm text-body-sm text-on-surface-variant block mt-1">Llegaron y viajaron hoy</span>
</div>
</div>
</div>
  );
}
