"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { actualizarActividad, cerrarSesion, registrarSesion } from "@/app/actions/sessions";
import { useEffect } from "react";

interface DashboardLayoutShellProps {
  children: React.ReactNode;
  userEmail?: string;
  userName?: string;
  avatarUrl?: string;
  isAdmin?: boolean;
}

export default function DashboardLayoutShell({
  children,
  userEmail,
  userName,
  avatarUrl,
  isAdmin = false,
}: DashboardLayoutShellProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshSuccess, setRefreshSuccess] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    let interval: NodeJS.Timeout;

    const initSession = async () => {
      let sessionId = localStorage.getItem('sessionId');
      
      if (!sessionId) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const location = await new Promise<{lat: number | null, lon: number | null} | null>((resolve) => {
          if (!navigator.geolocation) {
             alert("Tu navegador no soporta geolocalización.");
             resolve({ lat: null, lon: null });
             return;
          }
          navigator.geolocation.getCurrentPosition(
            (pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
            (err) => {
              alert("Permiso de ubicación denegado. Es obligatorio para acceder al sistema.");
              supabase.auth.signOut().then(() => router.push("/login"));
              resolve(null);
            },
            { timeout: 10000, maximumAge: 0 }
          );
        });

        if (!location) return; // Bloqueado por falta de GPS

        const res = await registrarSesion(location.lat, location.lon, navigator.userAgent);
        if (res.success && res.sessionId) {
          sessionId = res.sessionId as string;
          localStorage.setItem('sessionId', sessionId as string);
        }
      }

      if (sessionId) {
        actualizarActividad(sessionId);
        interval = setInterval(() => {
          actualizarActividad(sessionId);
        }, 60000);
      }
    };

    initSession();

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [supabase.auth, router]);

  const handleLogout = async () => {
    const sessionId = localStorage.getItem('sessionId');
    if (sessionId) {
      await cerrarSesion(sessionId);
      localStorage.removeItem('sessionId');
    }
    await supabase.auth.signOut();
    router.push("/login");
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
      {/* DESKTOP WEB OVERLAY MENU (Animated Circle)*/}
      {/* ========================================= */}
      
      {/* Botón Hamburguesa Web (Oculto en Móvil) */}
      <button
        className="hidden md:flex fixed z-50 top-4 left-6 w-12 h-12 flex-col justify-center items-center gap-2 bg-transparent border-none cursor-pointer outline-none"
        onClick={() => setIsMenuOpen(!isMenuOpen)}
        aria-label="Alternar Menú"
      >
        <div className={`w-8 h-1 bg-white transition-all duration-300 rounded ${isMenuOpen ? 'rotate-45 translate-y-3 bg-[#E31837]' : ''}`}></div>
        <div className={`w-8 h-1 bg-white transition-all duration-300 rounded ${isMenuOpen ? 'opacity-0' : ''}`}></div>
        <div className={`w-8 h-1 bg-white transition-all duration-300 rounded ${isMenuOpen ? '-rotate-45 -translate-y-3 bg-[#E31837]' : ''}`}></div>
      </button>

      {/* Fondo Circular Animado Web */}
      <div
        className={`hidden md:block fixed z-40 top-10 left-12 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#0A192F]/95 backdrop-blur-xl transition-all duration-700 ease-in-out ${
          isMenuOpen ? "h-[300vh] w-[300vh] opacity-100" : "h-24 w-24 opacity-0 pointer-events-none"
        }`}
      ></div>

      {/* Navegación Web Desktop */}
      <div
        className={`hidden md:flex fixed inset-0 z-40 items-center transition-all duration-300 ${
          isMenuOpen ? "opacity-100 visible" : "opacity-0 invisible delay-200"
        }`}
      >
        <nav className="flex flex-col items-start pl-[15%] group w-full">
          {navLinks.map((link, index) => (
            <Link
              key={link.name}
              href={link.path}
              onClick={() => setIsMenuOpen(false)}
              className={`text-[#f9f9f9] text-3xl md:text-5xl py-5 transition-all duration-400 capitalize hover:text-[#E31837] hover:translate-x-4 group-hover:opacity-25 hover:!opacity-100 ${
                isMenuOpen ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"
              }`}
              style={{
                transitionDelay: isMenuOpen ? `${0.1 * (index + 1)}s` : "0s",
              }}
            >
              {link.name}
            </Link>
          ))}
          
          {/* Logout Button in Menu */}
          <button
            onClick={handleLogout}
            className={`text-[#f9f9f9] mt-10 flex items-center gap-4 text-2xl py-5 transition-all duration-400 hover:text-[#E31837] hover:translate-x-4 group-hover:opacity-25 hover:!opacity-100 ${
                isMenuOpen ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"
              }`}
              style={{
                transitionDelay: isMenuOpen ? `${0.1 * (navLinks.length + 1)}s` : "0s",
              }}
          >
            <span className="material-symbols-outlined text-3xl">logout</span>
            Cerrar Sesión
          </button>
        </nav>
      </div>

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
            {isAdmin && (
              <Link
                href="/dashboard/admin"
                className="flex items-center justify-center gap-1 px-2 py-1.5 rounded-full bg-surface-container-highest/20 active:bg-surface-container-highest/40 transition-colors border border-outline-variant/30 text-on-primary"
              >
                <span className="material-symbols-outlined text-emerald-500/80 text-[18px]">admin_panel_settings</span>
                <span className="font-label-sm text-[11px] uppercase font-bold tracking-wider">Admin</span>
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
        <div className="w-full h-full px-8 flex items-center justify-between max-w-[1600px] mx-auto ml-[72px]">
          {/* Logo Desktop (Blanco) */}
          <Link href="/dashboard" className="flex items-center gap-space-xs hover:opacity-80 transition-opacity">
            <img src="/logo.png" alt="Air Panama Logo" className="w-10 h-10 object-contain drop-shadow-md" />
            <span className="font-headline-md text-headline-md font-black tracking-tighter text-on-primary italic pr-2">AirPanama</span>
          </Link>
          
          {/* User profile Desktop */}
          <div className="flex items-center gap-space-sm">
            {isAdmin && (
              <Link
                href="/dashboard/admin"
                className="flex items-center gap-2 px-4 py-2 rounded-full bg-surface-container-highest/20 hover:bg-surface-container-highest/40 transition-colors border border-outline-variant/30 text-on-primary group"
              >
                <span className="material-symbols-outlined text-emerald-500/80 group-hover:text-emerald-400 transition-colors text-sm">admin_panel_settings</span>
                <span className="font-label-sm text-label-sm uppercase font-bold tracking-wider group-hover:text-emerald-400 transition-colors">Admin</span>
              </Link>
            )}
            
            <div className="w-px h-6 bg-outline-variant/30 hidden md:block mx-1"></div>

            <div className="flex items-center gap-space-xs">
              <span className="font-label-md text-label-md text-on-primary">
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
      {/* MAIN CONTENT CON EFECTO BLUR EN WEB       */}
      {/* ========================================= */}
      <main 
        className={`flex flex-col relative w-full overflow-x-hidden pt-16 pb-[calc(5rem+env(safe-area-inset-bottom))] md:pt-28 md:pb-8 bg-surface flex-grow min-h-screen max-w-[1600px] mx-auto transition-all duration-500 ease-in-out ${
          isMenuOpen ? "md:blur-md md:opacity-50" : ""
        }`}
      >
        {/* Contenido inyectado por las páginas */}
        <div className="px-4 md:px-8">
          {children}
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
