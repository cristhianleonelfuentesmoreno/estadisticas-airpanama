"use client";

import { useState, useEffect } from "react";
import "./LoginCard.css";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import Link from "next/link";

const CardBackground = ({ activeView }: { activeView: string }) => (
  <div className={`card-bg ${activeView === "login" ? "login" : ""}`} />
);

const GoogleButton = ({ text, onClick, loading }: { text: string, onClick: () => void, loading: boolean }) => {
  return (
    <button 
      type="button" 
      onClick={onClick}
      disabled={loading}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px',
        width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #ddd',
        background: 'white', color: '#333', cursor: 'pointer', fontWeight: 500,
        transition: '0.2s ease',
        opacity: loading ? 0.7 : 1
      }}
    >
      <svg viewBox="0 0 24 24" width="20" height="20" xmlns="http://www.w3.org/2000/svg">
        <g transform="matrix(1, 0, 0, 1, 27.009001, -39.238998)">
          <path fill="#4285F4" d="M -3.264 51.509 C -3.264 50.719 -3.334 49.969 -3.454 49.239 L -14.754 49.239 L -14.754 53.749 L -8.284 53.749 C -8.574 55.229 -9.424 56.479 -10.684 57.329 L -10.684 60.329 L -6.824 60.329 C -4.564 58.239 -3.264 55.159 -3.264 51.509 Z"/>
          <path fill="#34A853" d="M -14.754 63.239 C -11.514 63.239 -8.804 62.159 -6.824 60.329 L -10.684 57.329 C -11.764 58.049 -13.134 58.489 -14.754 58.489 C -17.884 58.489 -20.534 56.379 -21.484 53.529 L -25.464 53.529 L -25.464 56.619 C -23.494 60.539 -19.444 63.239 -14.754 63.239 Z"/>
          <path fill="#FBBC05" d="M -21.484 53.529 C -21.734 52.809 -21.864 52.039 -21.864 51.239 C -21.864 50.439 -21.724 49.669 -21.484 48.949 L -21.484 45.859 L -25.464 45.859 C -26.284 47.479 -26.754 49.299 -26.754 51.239 C -26.754 53.179 -26.284 54.999 -25.464 56.619 L -21.484 53.529 Z"/>
          <path fill="#EA4335" d="M -14.754 43.989 C -12.984 43.989 -11.404 44.599 -10.154 45.789 L -6.734 42.369 C -8.804 40.429 -11.514 39.239 -14.754 39.239 C -19.444 39.239 -23.494 41.939 -25.464 45.859 L -21.484 48.949 C -20.534 46.099 -17.884 43.989 -14.754 43.989 Z"/>
        </g>
      </svg>
      {loading ? 'Conectando...' : text}
    </button>
  );
};

const HeroPanel = ({ type, activeView, title, buttonText, onToggle }: any) => (
  <div className={`hero ${type} ${activeView === type ? "active" : ""}`}>
    <h2 style={{ fontSize: '2rem', margin: '0 0 10px 0' }}>{title}</h2>
    <button type="button" onClick={onToggle} style={{ marginTop: '20px' }}>
      {buttonText}
    </button>
  </div>
);

export const LoginCard = () => {
  const [activeView, setActiveView] = useState("login");
  const [loading, setLoading] = useState(false);
  const [regName, setRegName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [logEmail, setLogEmail] = useState("");
  const [logPassword, setLogPassword] = useState("");
  const router = useRouter();

  const supabase = createClient();

  // Reset loading state if user navigates back (bfcache)
  useEffect(() => {
    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        setLoading(false);
      }
    };
    window.addEventListener('pageshow', handlePageShow);
    
    // Safety timeout to reset loading if OAuth doesn't redirect
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        setLoading(false);
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    
    return () => {
      window.removeEventListener('pageshow', handlePageShow);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    
    if (params.get("error") === "true") {
      toast.custom((t) => (
        <div className="bg-surface-container-lowest border-l-4 border-red-500 p-4 rounded-xl shadow-lg flex items-start gap-4 animate-in slide-in-from-bottom-5 w-full max-w-sm">
          <div className="bg-red-100 text-red-600 rounded-full p-1.5 flex-shrink-0 mt-0.5">
            <span className="material-symbols-outlined text-xl">error</span>
          </div>
          <div>
            <h3 className="font-headline-sm text-sm font-bold text-on-surface">Error de autenticación</h3>
            <p className="font-body-sm text-xs text-on-surface-variant mt-1">Error al autenticar o solicitud rechazada.</p>
          </div>
        </div>
      ), { duration: 6000 });
      window.history.replaceState(null, "", window.location.pathname);
    }
    
    if (params.get("status") === "pending") {
      toast.custom((t) => (
        <div className="bg-surface-container-lowest border-l-4 border-amber-500 p-4 rounded-xl shadow-lg flex items-start gap-4 animate-in slide-in-from-bottom-5 w-full max-w-sm">
          <div className="bg-amber-100 text-amber-600 rounded-full p-1.5 flex-shrink-0 mt-0.5">
            <span className="material-symbols-outlined text-xl">pending_actions</span>
          </div>
          <div>
            <h3 className="font-headline-sm text-sm font-bold text-on-surface">Acceso Pendiente</h3>
            <p className="font-body-sm text-xs text-on-surface-variant mt-1">Su cuenta está pendiente de aprobación por el administrador.</p>
          </div>
        </div>
      ), { duration: 6000 });
      window.history.replaceState(null, "", window.location.pathname);
    }
    
    if (params.get("error") === "not_registered") {
      toast.custom((t) => (
        <div className="bg-surface-container-lowest border-l-4 border-red-500 p-4 rounded-xl shadow-lg flex items-start gap-4 animate-in slide-in-from-bottom-5 w-full max-w-sm">
          <div className="bg-red-100 text-red-600 rounded-full p-1.5 flex-shrink-0 mt-0.5">
            <span className="material-symbols-outlined text-xl">error</span>
          </div>
          <div>
            <h3 className="font-headline-sm text-sm font-bold text-on-surface">Error de autenticación</h3>
            <p className="font-body-sm text-xs text-on-surface-variant mt-1">El usuario o la contraseña son incorrectos.</p>
          </div>
        </div>
      ), { duration: 6000 });
      window.history.replaceState(null, "", window.location.pathname);
    }
    
    if (params.get("status") === "registered_google") {
      toast.custom((t) => (
        <div className="bg-surface-container-lowest border-l-4 border-emerald-500 p-4 rounded-xl shadow-lg flex items-start gap-4 animate-in slide-in-from-bottom-5 w-full max-w-sm">
          <div className="bg-emerald-100 text-emerald-600 rounded-full p-1.5 flex-shrink-0 mt-0.5">
            <span className="material-symbols-outlined text-xl">check_circle</span>
          </div>
          <div>
            <h3 className="font-headline-sm text-sm font-bold text-on-surface">¡Solicitud Enviada!</h3>
            <p className="font-body-sm text-xs text-on-surface-variant mt-1">Su cuenta está pendiente de aprobación por el administrador.</p>
          </div>
        </div>
      ), { duration: 8000 });
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, []);

  const toggleView = () => setActiveView(activeView === "login" ? "register" : "login");

  const handleGoogleAuth = async (action: 'login' | 'register') => {
    try {
      setLoading(true);
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/api/auth/callback?action=${action}`,
        }
      });
      if (error) {
        alert("Error con Google: " + error.message);
        setLoading(false);
      }
    } catch (err) {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regEmail || !regPassword || !regName) return toast.error("Todos los campos son obligatorios.");
    
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email: regEmail,
      password: regPassword,
      options: { data: { full_name: regName } }
    });

    setLoading(false);
    if (error) {
      toast.error(error.message);
    } else {
      // Como por defecto entran como "pendiente", cerramos sesión local y mostramos mensaje de marketing
      await supabase.auth.signOut();
      toast.success("¡Tu solicitud para ingresar al programa ha sido enviada! El administrador autorizará tu acceso pronto.", { duration: 8000 });
      setActiveView("login");
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!logEmail || !logPassword) {
      return toast.error("Ingresa correo y contraseña.");
    }
    
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({
      email: logEmail,
      password: logPassword,
    });

    if (error) {
      setLoading(false);
      return toast.custom((t) => (
        <div className="bg-surface-container-lowest border-l-4 border-red-500 p-4 rounded-xl shadow-lg flex items-start gap-4 animate-in slide-in-from-bottom-5 w-full max-w-sm">
          <div className="bg-red-100 text-red-600 rounded-full p-1.5 flex-shrink-0 mt-0.5">
            <span className="material-symbols-outlined text-xl">error</span>
          </div>
          <div>
            <h3 className="font-headline-sm text-sm font-bold text-on-surface">Error de autenticación</h3>
            <p className="font-body-sm text-xs text-on-surface-variant mt-1">El usuario o la contraseña son incorrectos.</p>
          </div>
        </div>
      ), { duration: 6000 });
    }

    if (data?.user) {
      const { data: perfil } = await supabase
        .from('perfiles')
        .select('status')
        .eq('id', data.user.id)
        .single();

      // Validación de seguridad estricta
      if (!perfil || perfil.status !== 'aprobado') {
        await supabase.auth.signOut();
        setLoading(false);
        
        if (!perfil || perfil.status === 'pendiente') {
          return toast.custom((t) => (
            <div className="bg-surface-container-lowest border-l-4 border-amber-500 p-4 rounded-xl shadow-lg flex items-start gap-4 animate-in slide-in-from-bottom-5 w-full max-w-sm">
              <div className="bg-amber-100 text-amber-600 rounded-full p-1.5 flex-shrink-0 mt-0.5">
                <span className="material-symbols-outlined text-xl">pending_actions</span>
              </div>
              <div>
                <h3 className="font-headline-sm text-sm font-bold text-on-surface">Acceso Pendiente</h3>
                <p className="font-body-sm text-xs text-on-surface-variant mt-1">Su cuenta está pendiente de aprobación por el administrador.</p>
              </div>
            </div>
          ), { duration: 6000 });
        } else if (perfil.status === 'rechazado') {
          return toast.custom((t) => (
            <div className="bg-surface-container-lowest border-l-4 border-red-500 p-4 rounded-xl shadow-lg flex items-start gap-4 animate-in slide-in-from-bottom-5 w-full max-w-sm">
              <div className="bg-red-100 text-red-600 rounded-full p-1.5 flex-shrink-0 mt-0.5">
                <span className="material-symbols-outlined text-xl">block</span>
              </div>
              <div>
                <h3 className="font-headline-sm text-sm font-bold text-on-surface">Acceso Denegado</h3>
                <p className="font-body-sm text-xs text-on-surface-variant mt-1">Su cuenta ha sido denegada por un administrador.</p>
              </div>
            </div>
          ), { duration: 6000 });
        }
      } else {
        // Credenciales correctas y estatus 'aprobado'
        window.location.href = "/dashboard?login=success";
      }
    }
  };

  return (
    <div className="card-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: '#f0f2f5' }}>
      <div className="card">
        <CardBackground activeView={activeView} />
        
        <HeroPanel
          type="register"
          activeView={activeView}
          title="¡Bienvenido de vuelta!"
          text="Para mantenerte conectado con nosotros, por favor inicia sesión con tu información."
          buttonText="INICIAR SESIÓN"
          onToggle={toggleView}
        />
        
        <div className={`form register ${activeView === "register" ? "active" : ""}`}>
          <h2>Registro</h2>
          <GoogleButton text="Regístrate con Google" onClick={() => handleGoogleAuth('register')} loading={loading} />
          <p>O usa tu correo para registrarte</p>
          <form className="form-inputs" onSubmit={handleRegister} suppressHydrationWarning>
            <input type="text" placeholder="Nombre completo" value={regName} onChange={e => setRegName(e.target.value)} required suppressHydrationWarning />
            <input type="email" placeholder="Correo electrónico" value={regEmail} onChange={e => setRegEmail(e.target.value)} required suppressHydrationWarning />
            <input type="password" placeholder="Contraseña" value={regPassword} onChange={e => setRegPassword(e.target.value)} required minLength={6} suppressHydrationWarning />
            <button className="submit-btn" type="submit" disabled={loading}>
              {loading ? "PROCESANDO..." : "REGISTRARSE"}
            </button>
          </form>
        </div>
        
        <HeroPanel
          type="login"
          activeView={activeView}
          title="¡Hola!"
          text="Ingresa tus datos personales y empieza el viaje con nosotros."
          buttonText="REGISTRARSE"
          onToggle={toggleView}
        />
        
        <div className={`form login ${activeView === "login" ? "active" : ""}`}>
          <h2>Iniciar Sesión</h2>
          <GoogleButton text="Ingresa con Google" onClick={() => handleGoogleAuth('login')} loading={loading} />
          <p>O usa tu cuenta local</p>
          <form className="form-inputs" onSubmit={handleLogin} suppressHydrationWarning>
            <input type="email" placeholder="Correo electrónico" value={logEmail} onChange={e => setLogEmail(e.target.value)} required suppressHydrationWarning />
            <input type="password" placeholder="Contraseña" value={logPassword} onChange={e => setLogPassword(e.target.value)} required suppressHydrationWarning />
            <Link href="/forgot-password" style={{ paddingTop: 6, marginBottom: 7, fontSize: '0.85rem', color: '#666', textDecoration: 'none', textAlign: 'left' }}>
              ¿Olvidaste tu contraseña?
            </Link>
            <button className="submit-btn" type="submit" disabled={loading}>
              {loading ? "PROCESANDO..." : "INICIAR SESIÓN"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
