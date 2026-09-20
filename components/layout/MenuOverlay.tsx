"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { Menu, X, Home, Table, BarChart2, LogOut, User } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function MenuOverlay() {
  const [isOpen, setIsOpen] = useState(false);
  const [user, setUser] = useState<any>(null);
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();

  useEffect(() => {
    // Fetch current user
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
    };
    getUser();
  }, [supabase.auth]);

  // Close menu on route change
  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  const navLinks = [
    { name: "Inicio (Dashboard)", href: "/dashboard", icon: Home },
    { name: "Tablas Diarias", href: "/dashboard/diario", icon: Table },
    { name: "Reportes Mensuales", href: "/dashboard/mensual", icon: BarChart2 },
  ];

  return (
    <>
      {/* Botón Hamburguesa Superior */}
      <button 
        onClick={() => setIsOpen(true)}
        className="p-2 text-airblue hover:bg-airlight rounded-md transition-colors"
        aria-label="Abrir Menú"
      >
        <Menu size={28} />
      </button>

      {/* Overlay Translúcido */}
      <div 
        className={`fixed inset-0 bg-airblue/95 backdrop-blur-sm z-50 transition-all duration-300 flex flex-col ${
          isOpen ? "opacity-100 pointer-events-auto translate-x-0" : "opacity-0 pointer-events-none translate-x-12"
        }`}
      >
        {/* Cabecera del Menú */}
        <div className="flex justify-end p-6">
          <button 
            onClick={() => setIsOpen(false)}
            className="p-2 text-white hover:text-airred transition-colors"
            aria-label="Cerrar Menú"
          >
            <X size={40} strokeWidth={2.5} />
          </button>
        </div>

        {/* Enlaces de Navegación */}
        <nav className="flex-1 flex flex-col justify-center px-8 sm:px-16 gap-10">
          {navLinks.map((link) => {
            const isActive = pathname === link.href;
            const Icon = link.icon;
            
            return (
              <Link 
                key={link.href} 
                href={link.href}
                className={`group flex items-center gap-6 text-3xl font-bold transition-colors ${
                  isActive ? "text-white" : "text-gray-400 hover:text-white"
                }`}
              >
                <Icon size={36} strokeWidth={3} className={`transition-colors ${isActive ? "text-airred" : "group-hover:text-airred"}`} />
                <span>{link.name}</span>
              </Link>
            )
          })}
        </nav>

        {/* Sección de Usuario Inferior */}
        <div className="p-8 mt-auto border-t border-white/20 bg-black/20 shadow-[0_-10px_40px_rgba(0,0,0,0.1)]">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6 max-w-5xl mx-auto w-full">
            
            {/* Información del Usuario */}
            <div className="flex items-center gap-4 text-white">
              <div className="w-16 h-16 rounded-full bg-airblue-light flex items-center justify-center overflow-hidden border-2 border-white/50 shadow-inner">
                {user?.user_metadata?.avatar_url ? (
                  <img src={user.user_metadata.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <User size={32} className="text-white" />
                )}
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-xl">{user?.user_metadata?.full_name || "Usuario"}</span>
                <span className="text-sm text-gray-300 font-medium">{user?.email}</span>
              </div>
            </div>

            {/* Botón de Cerrar Sesión */}
            <button 
              onClick={handleLogout}
              className="flex items-center gap-2 px-8 py-4 rounded-full bg-airred text-white hover:bg-red-700 transition-colors font-bold shadow-xl hover:shadow-red-900/50 hover:-translate-y-0.5 active:translate-y-0"
            >
              <LogOut size={22} strokeWidth={2.5} />
              Cerrar Sesión
            </button>
            
          </div>
        </div>
      </div>
    </>
  );
}
