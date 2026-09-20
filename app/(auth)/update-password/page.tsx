"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

export default function UpdatePasswordPage() {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    // Supabase automatically sets the session from the URL hash when arriving here
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("El enlace es inválido o ha expirado.");
        router.push("/login");
      }
    };
    checkSession();
  }, [router, supabase.auth]);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) return toast.error("La contraseña debe tener al menos 6 caracteres.");

    setLoading(true);
    const { error } = await supabase.auth.updateUser({
      password: password
    });

    setLoading(false);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Contraseña actualizada exitosamente.");
      router.push("/dashboard");
    }
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: '#f0f2f5', fontFamily: 'sans-serif' }}>
      <div style={{ background: "white", padding: "40px", borderRadius: "12px", boxShadow: "0 10px 30px rgba(0,0,0,0.05)", width: "100%", maxWidth: "400px", textAlign: "center" }}>
        <h2 style={{ margin: "0 0 10px 0", color: "#333" }}>Nueva Contraseña</h2>
        <p style={{ color: "#666", fontSize: "0.95rem", marginBottom: "24px" }}>
          Ingresa tu nueva contraseña para acceder a tu cuenta.
        </p>
        
        <form onSubmit={handleUpdate} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <input 
            type="password" 
            placeholder="Nueva contraseña" 
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            style={{ padding: "12px", borderRadius: "8px", border: "1px solid #ddd", width: "100%", fontSize: "1rem" }}
          />
          <button 
            type="submit" 
            disabled={loading}
            style={{ padding: "12px", background: "#212625", color: "white", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: "bold" }}
          >
            {loading ? "ACTUALIZANDO..." : "ACTUALIZAR CONTRASEÑA"}
          </button>
        </form>
      </div>
    </div>
  );
}
