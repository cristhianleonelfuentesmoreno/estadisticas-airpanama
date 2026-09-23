"use client";

import { useState, useEffect } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { toast } from "sonner";
import Link from "next/link";

type LinkState = "checking" | "ready" | "invalid";

// Cliente propio sin detección automática de la URL: el enlace de un admin llega como
// #access_token (flujo implícito) y el cliente PKCE por defecto lo rechazaría.
// Lo procesamos a mano; la sesión se guarda en las mismas cookies que usa el resto de la app.
function createRecoveryClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { isSingleton: false, auth: { detectSessionInUrl: false } }
  );
}

async function resolveRecoverySession(supabase: ReturnType<typeof createRecoveryClient>): Promise<boolean> {
  const hash = new URLSearchParams(window.location.hash.slice(1));
  if (hash.get("error")) return false;

  const accessToken = hash.get("access_token");
  const refreshToken = hash.get("refresh_token");
  if (accessToken && refreshToken) {
    const { error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
    // Quitamos los tokens de la barra de direcciones
    window.history.replaceState(null, "", window.location.pathname);
    if (error) return false;
  }

  // Si vino por /api/auth/confirm, la sesión ya está en las cookies
  const { data: { user } } = await supabase.auth.getUser();
  return !!user;
}

const inputStyle = { padding: "12px", borderRadius: "8px", border: "1px solid #ddd", width: "100%", fontSize: "1rem" };

export default function UpdatePasswordPage() {
  const [supabase] = useState(createRecoveryClient);
  const [linkState, setLinkState] = useState<LinkState>("checking");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    resolveRecoverySession(supabase)
      .then(ok => { if (!cancelled) setLinkState(ok ? "ready" : "invalid"); })
      .catch(() => { if (!cancelled) setLinkState("invalid"); });
    return () => { cancelled = true; };
  }, [supabase]);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) return toast.error("La contraseña debe tener al menos 6 caracteres.");
    if (password !== confirm) return toast.error("Las contraseñas no coinciden.");

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Contraseña actualizada exitosamente.");
      // Recarga completa para que el layout del servidor lea la sesión
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign("/dashboard");
    }
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: '#f0f2f5', fontFamily: 'sans-serif' }}>
      <div style={{ background: "white", padding: "40px", borderRadius: "12px", boxShadow: "0 10px 30px rgba(0,0,0,0.05)", width: "100%", maxWidth: "400px", textAlign: "center" }}>
        {linkState === "checking" && (
          <p style={{ color: "#666", fontSize: "0.95rem", margin: 0 }}>Verificando enlace...</p>
        )}

        {linkState === "invalid" && (
          <>
            <h2 style={{ margin: "0 0 10px 0", color: "#333" }}>Enlace no válido</h2>
            <p style={{ color: "#666", fontSize: "0.95rem", marginBottom: "24px" }}>
              El enlace expiró, ya fue usado o se abrió en otro navegador. Solicita uno nuevo.
            </p>
            <Link href="/forgot-password" style={{ display: "block", padding: "12px", background: "#212625", color: "white", borderRadius: "8px", fontWeight: "bold", textDecoration: "none" }}>
              SOLICITAR NUEVO ENLACE
            </Link>
          </>
        )}

        {linkState === "ready" && (
          <>
            <h2 style={{ margin: "0 0 10px 0", color: "#333" }}>Nueva Contraseña</h2>
            <p style={{ color: "#666", fontSize: "0.95rem", marginBottom: "24px" }}>
              Ingresa tu nueva contraseña para acceder a tu cuenta.
            </p>
            <form onSubmit={handleUpdate} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <input
                type="password"
                autoComplete="new-password"
                placeholder="Nueva contraseña"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                style={inputStyle}
              />
              <input
                type="password"
                autoComplete="new-password"
                placeholder="Confirmar contraseña"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                minLength={6}
                style={inputStyle}
              />
              <button
                type="submit"
                disabled={loading}
                style={{ padding: "12px", background: "#212625", color: "white", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: "bold" }}
              >
                {loading ? "ACTUALIZANDO..." : "ACTUALIZAR CONTRASEÑA"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
