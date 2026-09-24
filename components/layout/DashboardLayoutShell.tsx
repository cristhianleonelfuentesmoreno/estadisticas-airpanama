"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { actualizarActividad, cerrarSesion, registrarSesion } from "@/app/actions/sessions";
import { useEffect } from "react";
import { SurgeNav } from "./SurgeNav";
import { logUserEvent } from "@/app/actions/audit";
import { can, type Role } from "@/lib/permissions";

// Estado de la verificación de ubicación: el panel solo se muestra con "ok"
type GeoStatus = "checking" | "ok" | "denied" | "unavailable" | "timeout" | "unsupported" | "error";

// Mensajes genéricos: sirven para cualquier dispositivo o sistema (computadora, celular o tablet)
const GEO_MESSAGES: Record<Exclude<GeoStatus, "checking" | "ok">, { title: string; text: string }> = {
  denied: {
    title: "Se requiere tu ubicación",
    text: "Se requiere tu ubicación para ver esta información. Permite el acceso a la ubicación para este sitio en la configuración de tu navegador y vuelve a intentarlo.",
  },
  unavailable: {
    title: "No se pudo obtener tu ubicación",
    text: "Verifica que la ubicación esté activada en tu dispositivo y que tu navegador tenga permiso para usarla, luego vuelve a intentarlo.",
  },
  timeout: {
    title: "La ubicación tardó demasiado",
    text: "No recibimos tu ubicación a tiempo. Revisa tu conexión y que la ubicación esté activada, luego vuelve a intentarlo.",
  },
  unsupported: {
    title: "Navegador no compatible",
    text: "Tu navegador no permite obtener la ubicación, que es obligatoria para acceder al sistema. Usa un navegador actualizado.",
  },
  error: {
    title: "No se pudo registrar tu sesión",
    text: "Ocurrió un problema al registrar tu acceso. Vuelve a intentarlo en unos segundos.",
  },
};

interface DashboardLayoutShellProps {
  children: React.ReactNode;
  userEmail?: string;
  userName?: string;
  avatarUrl?: string;
  role?: Role;
}

export default function DashboardLayoutShell({
  children,
  userEmail,
  userName,
  avatarUrl,
  role = 'usuario',
}: DashboardLayoutShellProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshSuccess, setRefreshSuccess] = useState(false);
  const [geoStatus, setGeoStatus] = useState<GeoStatus>("checking");
  const [geoAttempt, setGeoAttempt] = useState(0);
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const showPanel = can.accessPanel(role);
  const panelLabel = role === 'administrador' ? 'Admin' : 'Supervisión';

  // Bitácora: cada página que se abre (una vez por cambio de ruta)
  const lastLoggedPath = useRef<string | null>(null);
  useEffect(() => {
    if (!pathname || lastLoggedPath.current === pathname) return;
    lastLoggedPath.current = pathname;
    logUserEvent({ tipo: 'navegacion', ruta: pathname }).catch(() => {});
  }, [pathname]);

  useEffect(() => {
    let interval: NodeJS.Timeout;

    // La sesión venció o se cerró en otra pestaña: salir limpio y avisar en el login
    const expireSession = async () => {
      if (interval) clearInterval(interval);
      localStorage.removeItem('sessionId');
      await supabase.auth.signOut().catch(() => {});
      router.replace("/login?status=expired");
    };

    const heartbeat = (id: string) => {
      actualizarActividad(id)
        .then(res => { if (res.expired) expireSession(); })
        .catch(err => console.error("Latido de sesión:", err));
    };

    const initSession = async () => {
      let sessionId = localStorage.getItem('sessionId');
      
      if (!sessionId) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const location = await new Promise<{ lat: number; lon: number } | Exclude<GeoStatus, "checking" | "ok" | "error">>((resolve) => {
          if (!navigator.geolocation) return resolve("unsupported");
          navigator.geolocation.getCurrentPosition(
            (pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
            (err) => resolve(
              err.code === err.PERMISSION_DENIED ? "denied"
                : err.code === err.TIMEOUT ? "timeout"
                : "unavailable"
            ),
            { timeout: 15000, maximumAge: 0, enableHighAccuracy: true }
          );
        });

        // Sin ubicación no hay acceso: el panel queda bloqueado con el motivo
        if (typeof location === "string") return setGeoStatus(location);

        const res = await registrarSesion(location.lat, location.lon, navigator.userAgent).catch(() => null);
        if (!res) return expireSession();
        if (!res.success || !res.sessionId) {
          return setGeoStatus(res.error === "location_required" ? "unavailable" : "error");
        }
        sessionId = res.sessionId as string;
        localStorage.setItem('sessionId', sessionId);
      }

      if (sessionId) {
        const id = sessionId;
        setGeoStatus("ok");
        heartbeat(id);
        interval = setInterval(() => heartbeat(id), 60000);
      }
    };

    initSession();

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [supabase.auth, router, geoAttempt]);

  // Siempre termina en el login, aunque el registro del cierre en el servidor falle
  const handleLogout = async () => {
    const sessionId = localStorage.getItem('sessionId');
    try {
      if (sessionId) await cerrarSesion(sessionId);
    } catch (err) {
      console.error("No se pudo registrar el cierre de sesión:", err);
    } finally {
      localStorage.removeItem('sessionId');
      await supabase.auth.signOut().catch(() => {});
      router.push("/login");
    }
  };

  const handleRefresh = async () => {
    if (isRefreshing || refreshSuccess) return;
    setIsRefreshing(true);
    
    // Animación de carga para que el usuario sienta respuesta inmediata
    await new Promise(r => setTimeout(r, 600));
    
    setIsRefreshing(false);
    setRefreshSuccess(true);
    
    // Refresco profundo real (hard reload) justo al mostrar el check verde
    // para garantizar que todos los `useEffect` de la app vuelvan a pedir datos al backend
    setTimeout(() => {
      window.location.reload();
    }, 400);
  };

  const navLinks = [
    { name: "Inicio", path: "/dashboard", icon: "window" },
    { name: "Registro", path: "/dashboard/diario", icon: "edit_document" },
    { name: "Reportes", path: "/dashboard/mensual", icon: "analytics" },
  ];

  return (
    <>
      {/* ========================================= */}
      {/* HEADER MOBILE (Oculto en Web)             */}
      {/* ========================================= */}
      <header className="md:hidden fixed top-0 inset-x-0 z-50 bg-primary-container/95 backdrop-blur-xl shadow-[0_1px_8px_rgba(0,0,0,0.06)] pt-safe">
        <div className="h-16 px-gutter-mobile flex items-center justify-between gap-space-sm max-w-[1600px] mx-auto">
          {/* Logo */}
          <Link href="/dashboard" className="flex items-center gap-space-sm active:scale-95 transition-transform">
            <div className="flex items-center gap-space-xs">
              <img src="/logo.png" alt="Air Panama Logo" className="w-8 h-8 object-contain drop-shadow-sm" />
              <span className="font-headline-sm text-headline-sm font-black tracking-tighter text-on-primary italic">AirPanama</span>
            </div>
          </Link>

          {/* User Profile & Logout Mobile */}
          <div className="flex items-center gap-2">
            {showPanel && (
              <Link
                href="/dashboard/admin"
                className="flex items-center justify-center gap-1 px-2 py-1.5 rounded-full bg-surface-container-highest/20 active:bg-surface-container-highest/40 transition-colors border border-outline-variant/30 text-on-primary"
              >
                <span className="material-symbols-outlined text-emerald-500/80 text-[18px]">admin_panel_settings</span>
                <span className="font-label-sm text-[11px] uppercase font-bold tracking-wider">{panelLabel}</span>
              </Link>
            )}
            
            <button 
              onClick={handleRefresh}
              aria-label="Recargar página"
              title="Recargar página"
              className={`w-8 h-8 rounded-full flex items-center justify-center ring-1 ring-white/20 shadow-sm mx-1 transition-all duration-300 ${
                refreshSuccess 
                  ? "bg-emerald-500 text-white scale-105" 
                  : "bg-secondary text-white hover:bg-secondary/90 active:scale-95"
              }`}
            >
              {isRefreshing ? (
                <span className="material-symbols-outlined text-[18px] animate-spin">refresh</span>
              ) : refreshSuccess ? (
                <span className="material-symbols-outlined text-[18px] animate-in zoom-in">check</span>
              ) : (
                <span className="material-symbols-outlined text-[18px]">refresh</span>
              )}
            </button>
            <button 
              onClick={handleLogout}
              aria-label="Cerrar sesión" 
              className="w-11 h-11 flex items-center justify-center rounded-xl text-secondary-fixed-dim hover:text-on-secondary hover:bg-secondary active:scale-95 transition-all"
            >
              <span className="material-symbols-outlined text-[22px]">logout</span>
            </button>
          </div>
        </div>
      </header>

      {/* ========================================= */}
      {/* DESKTOP HEADER (Fondo Azul)               */}
      {/* ========================================= */}
      <header className="hidden md:flex fixed top-0 inset-x-0 h-20 z-30 bg-primary-container shadow-md">
        <div className="w-full h-full px-8 grid grid-cols-[1fr_auto_1fr] items-center gap-6 max-w-[1600px] mx-auto">
          {/* Logo Desktop (Blanco) */}
          <Link href="/dashboard" className="justify-self-start flex items-center gap-space-xs hover:opacity-80 transition-opacity">
            <img src="/logo.png" alt="Air Panama Logo" className="w-10 h-10 object-contain drop-shadow-md" />
            <span className="font-headline-md text-headline-md font-black tracking-tighter text-on-primary italic pr-2">AirPanama</span>
          </Link>
          
          {/* Secciones al centro (en móvil están en la barra inferior) */}
          <SurgeNav items={navLinks} pathname={pathname} />

          {/* User profile Desktop */}
          <div className="justify-self-end flex items-center gap-space-sm">
            {showPanel && (
              <Link
                href="/dashboard/admin"
                title={role === 'administrador' ? 'Panel de administrador' : 'Panel de supervisión'}
                className="flex items-center gap-2 px-3 lg:px-4 py-2 rounded-full bg-surface-container-highest/20 hover:bg-surface-container-highest/40 transition-colors border border-outline-variant/30 text-on-primary group"
              >
                <span className="material-symbols-outlined text-emerald-500/80 group-hover:text-emerald-400 transition-colors text-sm">admin_panel_settings</span>
                <span className="hidden lg:inline font-label-sm text-label-sm uppercase font-bold tracking-wider group-hover:text-emerald-400 transition-colors">{panelLabel}</span>
              </Link>
            )}
            
            <div className="w-px h-6 bg-outline-variant/30 hidden md:block mx-1"></div>

            <div className="flex items-center gap-space-xs">
              <span className="hidden lg:inline font-label-md text-label-md text-on-primary">
                {userName || (userEmail ? userEmail.split('@')[0] : "Usuario")}
              </span>
              {avatarUrl ? (
                <img 
                  alt="Profile" 
                  className="w-10 h-10 ml-2 rounded-full object-cover ring-2 ring-white/20 shadow-sm" 
                  src={avatarUrl} 
                />
              ) : (
                <div className="w-10 h-10 ml-2 rounded-full bg-secondary flex items-center justify-center text-white font-bold text-sm ring-2 ring-white/20 shadow-sm uppercase">
                  {userName ? userName.charAt(0) : (userEmail ? userEmail.charAt(0) : "U")}
                </div>
              )}
            </div>
            
            <div className="w-px h-6 bg-outline-variant/30 hidden md:block mx-1"></div>
            


            <button 
              onClick={handleLogout}
              aria-label="Cerrar sesión" 
              title="Cerrar sesión"
              className="w-10 h-10 flex items-center justify-center rounded-full text-on-primary/70 hover:text-white hover:bg-white/10 active:scale-95 transition-all"
            >
              <span className="material-symbols-outlined text-[20px]">logout</span>
            </button>
          </div>
        </div>
      </header>

      {/* ========================================= */}
      {/* MAIN CONTENT                              */}
      {/* ========================================= */}
      <main 
        className="flex flex-col relative w-full overflow-x-hidden pt-16 pb-[calc(5rem+env(safe-area-inset-bottom))] md:pt-28 md:pb-8 bg-surface flex-grow min-h-screen max-w-[1600px] mx-auto"
      >
        {/* Contenido inyectado por las páginas */}
        <div className="px-4 md:px-8">
          {geoStatus === "ok" ? children : (
            <div className="min-h-[60vh] flex items-center justify-center py-12">
              {geoStatus === "checking" ? (
                // Mismo cubo de la pantalla de carga de la app (app/loading.tsx)
                <div className="flex flex-col items-center" aria-busy="true" aria-label="Cargando">
                  <div className="spinner mb-8">
                    <div></div>
                    <div></div>
                    <div></div>
                    <div></div>
                    <div></div>
                    <div></div>
                  </div>
                  <p className="font-body-md text-body-md text-on-surface-variant animate-pulse">Cargando módulos…</p>
                </div>
              ) : (
                <div role="alert" className="max-w-md w-full bg-surface-container-lowest border border-outline-variant rounded-2xl shadow-sm p-6 text-center flex flex-col items-center gap-4">
                  <span className="material-symbols-outlined text-[44px] text-error">location_off</span>
                  <h2 className="font-headline-sm text-headline-sm font-bold text-on-surface">{GEO_MESSAGES[geoStatus].title}</h2>
                  <p className="font-body-md text-body-md text-on-surface-variant">{GEO_MESSAGES[geoStatus].text}</p>
                  <div className="flex flex-wrap justify-center gap-3 pt-2">
                    {geoStatus !== "unsupported" && (
                      <button
                        onClick={() => { setGeoStatus("checking"); setGeoAttempt(n => n + 1); }}
                        className="px-5 py-2.5 rounded-xl bg-secondary text-on-secondary font-bold active:scale-95 transition-transform"
                      >
                        Reintentar
                      </button>
                    )}
                    <button
                      onClick={handleLogout}
                      className="px-5 py-2.5 rounded-xl border border-outline-variant text-on-surface font-bold active:scale-95 transition-transform"
                    >
                      Cerrar sesión
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* ========================================= */}
      {/* BOTTOM NAVIGATION (Solo Móvil)            */}
      {/* ========================================= */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-[#0A192F] border-t border-white/10 shadow-[0_-4px_20px_rgba(10,25,47,0.25)] pb-safe">
        <div className="flex h-16">
          {navLinks.map((link) => {
            const isActive = pathname === link.path;
            return (
              <Link
                key={link.path}
                href={link.path}
                aria-current={isActive ? 'page' : undefined}
                className="flex-1 flex flex-col items-center justify-center gap-0.5 relative active:scale-95 transition-transform"
              >
                <span
                  className={`absolute top-0 h-[3px] w-10 rounded-b-full bg-[#E31837] transition-opacity duration-300 ${isActive ? 'opacity-100' : 'opacity-0'}`}
                />
                <span
                  className={`flex items-center justify-center w-12 h-8 rounded-full transition-colors duration-300 ${isActive ? 'bg-[#E31837]/15' : ''}`}
                >
                  <span className={`material-symbols-outlined text-[22px] ${isActive ? 'text-[#FF4D6A]' : 'text-slate-400'}`}>
                    {link.icon}
                  </span>
                </span>
                <span className={`text-[12px] tracking-wide ${isActive ? 'text-white font-bold' : 'text-slate-400 font-medium'}`}>
                  {link.name}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
