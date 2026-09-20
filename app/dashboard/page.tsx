
"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { FlightDecisionBoard } from "@/components/dashboard/FlightDecisionBoard";

export default function DashboardPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [userName, setUserName] = useState("Cargando...");
  const [userCargo, setUserCargo] = useState("...");
  const [currentTime, setCurrentTime] = useState("");

  useEffect(() => {
    // Reloj en vivo
    const updateTime = () => {
      const now = new Date();
      let hours = now.getHours();
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12;
      hours = hours ? hours : 12;
      const minutes = now.getMinutes().toString().padStart(2, '0');
      const seconds = now.getSeconds().toString().padStart(2, '0');
      setCurrentTime(`${hours}:${minutes}:${seconds} ${ampm} Local`);
    };
    
    updateTime();
    const interval = setInterval(updateTime, 1000);

    // Obtener datos del usuario
    const fetchUser = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: perfil } = await supabase.from('perfiles').select('nombre, cargo').eq('id', user.id).single();
        if (perfil) {
          setUserName(perfil.nombre || user.email?.split('@')[0] || "Usuario");
          setUserCargo(perfil.cargo || "Sin cargo asignado");
        }
      }
    };
    fetchUser();

    return () => clearInterval(interval);
  }, []);

  const handleRefresh = () => {
    setIsSyncing(true);
    setTimeout(() => {
      setIsSyncing(false);
      toast.success('METAR de Panamá Albrook actualizado');
    }, 800);
  };

  const handlePublish = () => {
    setIsModalOpen(false);
    toast.success('¡Vuelo despachado con éxito!');
  };

  return (
    <>
      <div className="flex flex-col w-full">
<div className="px-margin-mobile flex flex-col gap-space-md pt-space-md">
{/*  Welcome Greeting & Status Pill  */}
<div className="bg-primary-container text-on-primary rounded-xl p-space-md shadow-md relative overflow-hidden">
<div className="absolute -right-6 -bottom-6 w-32 h-32 bg-secondary-container/15 rounded-full blur-2xl pointer-events-none"></div>
<div className="flex items-center justify-between gap-space-sm relative z-10">
<div className="flex flex-col">
<div className="flex items-center gap-space-xs">
<span className="inline-flex w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
<span className="font-label-sm text-label-sm text-on-primary-container tracking-wider uppercase">Turno Activo</span>
</div>
<h1 className="font-headline-md text-headline-md font-extrabold tracking-tight mt-0.5 capitalize">{userName}</h1>
<p className="font-body-sm text-body-sm text-on-primary-container capitalize">{userCargo}</p>
</div>
<div className="w-12 h-12 rounded-xl bg-surface-container-highest/20 flex items-center justify-center text-secondary-fixed">
<span className="material-symbols-outlined text-[28px]">flight</span>
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
<div className="grid grid-cols-2 gap-space-sm"><Link href="/dashboard/diario" className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-primary text-on-primary font-label-md text-label-md font-bold shadow-sm active:scale-95 transition-all hover:bg-primary/90"><span className="material-symbols-outlined text-[18px] text-emerald-400">upload_file</span><span className="">+ Subir Diarios</span></Link><Link href="/dashboard/mensual" className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-surface-container-lowest text-secondary font-label-md text-label-md font-bold ring-1 ring-secondary/30 shadow-sm active:scale-95 transition-all hover:bg-secondary-container/15"><span className="material-symbols-outlined text-[18px] text-secondary">event_note</span><span className="">+ Reg. Mensual</span></Link></div>
{/*  Executive KPI Grid  */}
<div className="grid grid-cols-2 gap-space-sm">
{/*  Vuelos Activos  */}
<div className="bg-surface-container-lowest p-space-md rounded-xl shadow-sm flex flex-col justify-between">
<div className="flex items-center justify-between">
<span className="font-label-sm text-label-sm text-on-surface-variant uppercase">Vuelos Activos</span>
<span className="w-7 h-7 rounded-lg bg-tertiary-fixed flex items-center justify-center text-on-tertiary-fixed">
<span className="material-symbols-outlined text-[16px]">flight_takeoff</span>
</span>
</div>
<div className="mt-space-xs">
<span className="font-display-hero text-headline-lg-mobile font-extrabold text-on-surface leading-none">18</span>
<span className="font-body-sm text-body-sm text-on-surface-variant block mt-1">6 en ruta • 12 en rampa</span>
</div>
</div>
{/*  Puntualidad (OTP)  */}
<div className="bg-surface-container-lowest p-space-md rounded-xl shadow-sm flex flex-col justify-between">
<div className="flex items-center justify-between">
<span className="font-label-sm text-label-sm text-on-surface-variant uppercase">Puntualidad OTP</span>
<span className="w-7 h-7 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-800">
<span className="material-symbols-outlined text-[16px]">verified</span>
</span>
</div>
<div className="mt-space-xs">
<span className="font-display-hero text-headline-lg-mobile font-extrabold text-on-surface leading-none">94.8%</span>
<span className="font-label-sm text-label-sm text-emerald-700 block mt-1 font-bold">+2.3% vs. meta mes</span>
</div>
</div>
{/*  Pax en Tránsito  */}
<div className="bg-surface-container-lowest p-space-md rounded-xl shadow-sm flex flex-col justify-between">
<div className="flex items-center justify-between">
<span className="font-label-sm text-label-sm text-on-surface-variant uppercase">Pasajeros Hoy</span>
<span className="w-7 h-7 rounded-lg bg-surface-container-high flex items-center justify-center text-primary">
<span className="material-symbols-outlined text-[16px]">groups</span>
</span>
</div>
<div className="mt-space-xs">
<span className="font-display-hero text-headline-lg-mobile font-extrabold text-on-surface leading-none">1,420</span>
<span className="font-body-sm text-body-sm text-on-surface-variant block mt-1">Factor Ocup: 88.4%</span>
</div>
</div>
{/*  Alertas Meteorológicas  */}
<div className="bg-surface-container-lowest p-space-md rounded-xl shadow-sm flex flex-col justify-between">
<div className="flex items-center justify-between">
<span className="font-label-sm text-label-sm text-on-surface-variant uppercase">Alertas Ruta</span>
<span className="w-7 h-7 rounded-lg bg-secondary-fixed flex items-center justify-center text-on-secondary-fixed">
<span className="material-symbols-outlined text-[16px]">warning</span>
</span>
</div>
<div className="mt-space-xs">
<span className="font-display-hero text-headline-lg-mobile font-extrabold text-secondary leading-none">01</span>
<span className="font-body-sm text-body-sm text-secondary block mt-1 font-semibold">Cizalladura en Bocas</span>
</div>
</div>
</div>

{/*  Panel de Decisión de Vuelos (TAF)  */}
<div className="pt-space-xs">
<FlightDecisionBoard />
</div>

{/*  Scheduled Flight Feed  */}
<div className="flex flex-col gap-space-sm pt-space-xs pb-space-lg">
<div className="flex items-center justify-between px-1">
<div className="flex items-center gap-space-xs">
<h2 className="font-headline-sm text-headline-sm font-bold text-on-surface">Próximos Vuelos</h2>
<span className="px-2 py-0.5 rounded-full bg-surface-container-high text-on-surface font-label-sm text-label-sm">Hoy</span>
</div>
<Link className="font-label-md text-label-md text-secondary hover:underline flex items-center gap-0.5" href="/dashboard/diario">
          Ver todos
          <span className="material-symbols-outlined text-[16px]">chevron_right</span>
</Link>
</div>
{/*  Flight 1: PAC - DAV  */}
<div className="bg-surface-container-lowest rounded-xl p-space-md shadow-sm flex flex-col gap-space-sm relative">
<div className="flex items-center justify-between">
<div className="flex items-center gap-space-xs">
<span className="font-headline-sm text-headline-sm font-extrabold text-primary">7P-702</span>
<span className="px-2 py-0.5 rounded-full bg-surface-container text-on-surface-variant font-label-sm text-label-sm">Fokker 50 (HP-1890)</span>
</div>
<span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 font-label-sm text-label-sm uppercase flex items-center gap-1">
<span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
            A Tiempo
          </span>
</div>
<div className="flex items-center justify-between my-1">
<div className="flex flex-col">
<span className="font-label-code text-label-code text-primary">PAC</span>
<span className="font-body-sm text-body-sm text-on-surface-variant">Panamá (Albrook)</span>
<span className="font-label-md text-label-md text-on-surface font-bold mt-0.5">09:15</span>
</div>
<div className="flex flex-col items-center flex-1 px-space-md">
<span className="font-label-sm text-label-sm text-on-surface-variant">50 min</span>
<div className="w-full flex items-center gap-1 my-1">
<span className="h-0.5 w-full bg-surface-container-high rounded-full"></span>
<span className="material-symbols-outlined text-secondary text-[18px] transform rotate-90">flight</span>
<span className="h-0.5 w-full bg-surface-container-high rounded-full"></span>
</div>
<span className="font-label-sm text-label-sm text-primary font-semibold">Directo</span>
</div>
<div className="flex flex-col items-end text-right">
<span className="font-label-code text-label-code text-primary">DAV</span>
<span className="font-body-sm text-body-sm text-on-surface-variant">David (Malek)</span>
<span className="font-label-md text-label-md text-on-surface font-bold mt-0.5">10:05</span>
</div>
</div>
<div className="pt-space-xs border-t border-surface-container-high flex items-center justify-between text-on-surface-variant font-body-sm text-body-sm">
<span className="flex items-center gap-1">
<span className="material-symbols-outlined text-[16px] text-primary">gate</span>
            Puerta 03
          </span>
<span className="flex items-center gap-1">
<span className="material-symbols-outlined text-[16px] text-primary">person</span>
            Cap. A. Castillo
          </span>
<span className="flex items-center gap-1 font-label-md text-label-md text-primary">
            46/48 Pax
          </span>
</div>
</div>
{/*  Flight 2: PAC - BOC  */}
<div className="bg-surface-container-lowest rounded-xl p-space-md shadow-sm flex flex-col gap-space-sm relative">
<div className="flex items-center justify-between">
<div className="flex items-center gap-space-xs">
<span className="font-headline-sm text-headline-sm font-extrabold text-primary">7P-814</span>
<span className="px-2 py-0.5 rounded-full bg-surface-container text-on-surface-variant font-label-sm text-label-sm">Fokker 50 (HP-1721)</span>
</div>
<span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 font-label-sm text-label-sm uppercase flex items-center gap-1">
<span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
            A Tiempo
          </span>
</div>
<div className="flex items-center justify-between my-1">
<div className="flex flex-col">
<span className="font-label-code text-label-code text-primary">PAC</span>
<span className="font-body-sm text-body-sm text-on-surface-variant">Panamá (Albrook)</span>
<span className="font-label-md text-label-md text-on-surface font-bold mt-0.5">10:30</span>
</div>
<div className="flex flex-col items-center flex-1 px-space-md">
<span className="font-label-sm text-label-sm text-on-surface-variant">1h 00m</span>
<div className="w-full flex items-center gap-1 my-1">
<span className="h-0.5 w-full bg-surface-container-high rounded-full"></span>
<span className="material-symbols-outlined text-secondary text-[18px] transform rotate-90">flight</span>
<span className="h-0.5 w-full bg-surface-container-high rounded-full"></span>
</div>
<span className="font-label-sm text-label-sm text-primary font-semibold">Directo</span>
</div>
<div className="flex flex-col items-end text-right">
<span className="font-label-code text-label-code text-primary">BOC</span>
<span className="font-body-sm text-body-sm text-on-surface-variant">Bocas del Toro</span>
<span className="font-label-md text-label-md text-on-surface font-bold mt-0.5">11:30</span>
</div>
</div>
<div className="pt-space-xs border-t border-surface-container-high flex items-center justify-between text-on-surface-variant font-body-sm text-body-sm">
<span className="flex items-center gap-1">
<span className="material-symbols-outlined text-[16px] text-primary">gate</span>
            Puerta 01
          </span>
<span className="flex items-center gap-1">
<span className="material-symbols-outlined text-[16px] text-secondary">airline_stops</span>
            Tráfico Activo
          </span>
<span className="flex items-center gap-1 font-label-md text-label-md text-primary">
            48/48 Pax (Lleno)
          </span>
</div>
</div>
{/*  Flight 3: PAC - BLB (Boeing 737 Charter)  */}
<div className="bg-surface-container-lowest rounded-xl p-space-md shadow-sm flex flex-col gap-space-sm relative">
<div className="flex items-center justify-between">
<div className="flex items-center gap-space-xs">
<span className="font-headline-sm text-headline-sm font-extrabold text-primary">7P-901</span>
<span className="px-2 py-0.5 rounded-full bg-surface-container text-on-surface-variant font-label-sm text-label-sm">Boeing 737-400 (HP-1922)</span>
</div>
<span className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-900 font-label-sm text-label-sm uppercase flex items-center gap-1">
<span className="w-1.5 h-1.5 rounded-full bg-amber-600"></span>
            Abordando
          </span>
</div>
<div className="flex items-center justify-between my-1">
<div className="flex flex-col">
<span className="font-label-code text-label-code text-primary">PAC</span>
<span className="font-body-sm text-body-sm text-on-surface-variant">Panamá (Albrook)</span>
<span className="font-label-md text-label-md text-on-surface font-bold mt-0.5">11:45</span>
</div>
<div className="flex flex-col items-center flex-1 px-space-md">
<span className="font-label-sm text-label-sm text-on-surface-variant">1h 15m</span>
<div className="w-full flex items-center gap-1 my-1">
<span className="h-0.5 w-full bg-surface-container-high rounded-full"></span>
<span className="material-symbols-outlined text-secondary text-[18px] transform rotate-90">flight</span>
<span className="h-0.5 w-full bg-surface-container-high rounded-full"></span>
</div>
<span className="font-label-sm text-label-sm text-primary font-semibold">Chárter Especial</span>
</div>
<div className="flex flex-col items-end text-right">
<span className="font-label-code text-label-code text-primary">SJO</span>
<span className="font-body-sm text-body-sm text-on-surface-variant">San José (CR)</span>
<span className="font-label-md text-label-md text-on-surface font-bold mt-0.5">12:00</span>
</div>
</div>
<div className="pt-space-xs border-t border-surface-container-high flex items-center justify-between text-on-surface-variant font-body-sm text-body-sm">
<span className="flex items-center gap-1">
<span className="material-symbols-outlined text-[16px] text-primary">gate</span>
            Puerta Int-05
          </span>
<span className="flex items-center gap-1 text-secondary font-semibold">
<span className="material-symbols-outlined text-[16px]">how_to_reg</span>
            82 abordados
          </span>
<span className="flex items-center gap-1 font-label-md text-label-md text-primary">
            134/144 Pax
          </span>
</div>
</div>
</div>
</div>
{/*  Interactive Modal Drawer for Quick Flight Log (Micro-Interaction)  */}
<div className={`fixed inset-0 z-50 bg-primary/70 backdrop-blur-sm items-end justify-center ${isModalOpen ? "flex" : "hidden"}`} >
<div className="w-full max-w-lg bg-surface-container-lowest rounded-t-2xl p-margin-mobile shadow-xl flex flex-col gap-space-md animate-in slide-in-from-bottom duration-200">
<div className="flex items-center justify-between border-b border-surface-container pb-space-sm">
<div className="flex items-center gap-space-xs">
<div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center text-on-secondary">
<span className="material-symbols-outlined text-[18px]">flight</span>
</div>
<span className="font-headline-sm text-headline-sm font-bold text-on-surface">Registrar Despacho</span>
</div>
<button className="p-1 rounded-lg text-on-surface-variant hover:bg-surface-container" onClick={() => setIsModalOpen(false)}>
<span className="material-symbols-outlined text-[20px]">close</span>
</button>
</div>
<div className="flex flex-col gap-space-sm">
<label className="flex flex-col gap-1">
<span className="font-label-sm text-label-sm text-on-surface-variant uppercase">Número de Vuelo</span>
<input className="h-11 px-3 rounded-lg bg-surface-container-low text-on-surface font-label-md text-label-md focus:outline-none focus:bg-surface-container-lowest ring-1 ring-outline-variant" placeholder="Ej. 7P-704" type="text" suppressHydrationWarning />
</label>
<div className="grid grid-cols-2 gap-space-sm">
<label className="flex flex-col gap-1">
<span className="font-label-sm text-label-sm text-on-surface-variant uppercase">Origen</span>
<input className="h-11 px-3 rounded-lg bg-surface-container-low text-on-surface font-label-md text-label-md focus:outline-none focus:bg-surface-container-lowest ring-1 ring-outline-variant" type="text" defaultValue="PAC" suppressHydrationWarning />
</label>
<label className="flex flex-col gap-1">
<span className="font-label-sm text-label-sm text-on-surface-variant uppercase">Destino</span>
<input className="h-11 px-3 rounded-lg bg-surface-container-low text-on-surface font-label-md text-label-md focus:outline-none focus:bg-surface-container-lowest ring-1 ring-outline-variant" placeholder="DAV, BOC, CHX" type="text" suppressHydrationWarning />
</label>
</div>
<div className="grid grid-cols-2 gap-space-sm">
<label className="flex flex-col gap-1">
<span className="font-label-sm text-label-sm text-on-surface-variant uppercase">Aeronave</span>
<select className="h-11 px-3 rounded-lg bg-surface-container-low text-on-surface font-label-md text-label-md focus:outline-none focus:bg-surface-container-lowest ring-1 ring-outline-variant" suppressHydrationWarning>
<option>Fokker 50 (HP-1890)</option>
<option>Fokker 50 (HP-1721)</option>
<option>Boeing 737-400 (HP-1922)</option>
</select>
</label>
<label className="flex flex-col gap-1">
<span className="font-label-sm text-label-sm text-on-surface-variant uppercase">Salida Estimada</span>
<input className="h-11 px-3 rounded-lg bg-surface-container-low text-on-surface font-label-md text-label-md focus:outline-none focus:bg-surface-container-lowest ring-1 ring-outline-variant" type="time" defaultValue="13:30" suppressHydrationWarning />
</label>
</div>
</div>
<div className="flex items-center gap-space-sm pt-space-xs">
<button className="flex-1 h-12 rounded-xl bg-surface-container text-on-surface font-label-md text-label-md active:scale-95 transition-all" onClick={() => setIsModalOpen(false)}>Cancelar</button>
<button className="flex-1 h-12 rounded-xl bg-secondary text-on-secondary font-label-md text-label-md shadow-md active:scale-95 transition-all flex items-center justify-center gap-1" onClick={handlePublish}>
<span className="material-symbols-outlined text-[18px]">send</span>
          Publicar Plan
        </button>
</div>
</div>
</div>
</div>

    </>
  );
}
