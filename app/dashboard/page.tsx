"use client";

import { useState, useEffect } from "react";
import { FlightDecisionBoard } from "@/components/dashboard/FlightDecisionBoard";
import { FlightListBoard } from "@/components/dashboard/FlightListBoard";

export default function DashboardPage() {
  const [userName, setUserName] = useState("Cargando...");
  const [userCargo, setUserCargo] = useState("...");
  const [isAdmin, setIsAdmin] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState("");
  
  // Dashboard Metrics State
  const [vuelosCompletados, setVuelosCompletados] = useState(0);
  const [pasajerosHoy, setPasajerosHoy] = useState(0);

  useEffect(() => {
    // Reloj en vivo
    // Siempre en hora de Panamá, sin importar la zona horaria del dispositivo
    const updateTime = () => {
      const time = new Date().toLocaleTimeString('en-US', {
        timeZone: 'America/Panama',
        hour: 'numeric',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
      });
      setCurrentTime(`${time} Local`);
    };
    
    updateTime();
    const interval = setInterval(updateTime, 1000);

    const fetchUser = async () => {
      try {
        const { getCurrentUserProfile } = await import("@/app/actions/user");
        const profile = await getCurrentUserProfile();
        if (profile) {
          setUserName(profile.nombre);
          setUserCargo(profile.cargo);
          if (profile.avatar_url) setAvatarUrl(profile.avatar_url);
          if (profile.role === 'administrador') {
            setIsAdmin(true);
          }
        }
      } catch (e) {
        console.error("Error en fetchUser:", e);
      }
    };
    fetchUser();

    const fetchFlightStats = async () => {
      try {
        const { getUpcomingFlights } = await import("@/app/actions/flights");
        const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Panama' });
        const upcomingFlights = await getUpcomingFlights(today);
        
        // Filtrar los vuelos de David (DAV) tanto los que vienen como los que se van
        const davFlights = upcomingFlights.filter(f => f.origin === 'DAV' || f.destination === 'DAV');
        
        // Vuelos Totales en DAVID
        setVuelosCompletados(davFlights.length);
        
        // Pasajeros Totales
        const totalPax = davFlights.reduce((acc, f) => acc + (f.paxCount || 0), 0);
        setPasajerosHoy(totalPax);
        
      } catch (e) {
        console.error("Error fetching metrics:", e);
      }
    };
    fetchFlightStats();
    const statsInterval = setInterval(fetchFlightStats, 60000); // Actualizar cada minuto

    return () => {
      clearInterval(interval);
      clearInterval(statsInterval);
    };
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
<span className="font-display-hero text-headline-lg-mobile font-extrabold text-on-surface leading-none">{vuelosCompletados}</span>
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
<span className="font-display-hero text-headline-lg-mobile font-extrabold text-on-surface leading-none">{pasajerosHoy.toLocaleString()}</span>
<span className="font-body-sm text-body-sm text-on-surface-variant block mt-1">Llegaron y viajaron hoy</span>
</div>
</div>

</div>

{/*  Panel de Decisión de Vuelos (TAF)  */}
<div className="pt-space-xs">
<FlightDecisionBoard />
</div>

{/*  Scheduled Flight Feed  */}
<div className="pt-space-xs pb-space-lg">
<FlightListBoard isAdmin={isAdmin} />
</div>
</div>
</div>

    </>
  );
}
