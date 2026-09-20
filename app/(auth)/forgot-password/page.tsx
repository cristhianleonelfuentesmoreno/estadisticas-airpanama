"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return toast.error("Ingresa tu correo electrónico.");

    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/update-password`,
    });

    setLoading(false);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Te hemos enviado un correo con un enlace para restablecer tu contraseña.", { duration: 8000 });
      setEmail("");
    }
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: '#f0f2f5', fontFamily: 'sans-serif' }}>
      <div style={{ background: "white", padding: "40px", borderRadius: "12px", boxShadow: "0 10px 30px rgba(0,0,0,0.05)", width: "100%", maxWidth: "400px", textAlign: "center" }}>
        <h2 style={{ margin: "0 0 10px 0", color: "#333" }}>Recuperar Contraseña</h2>
        <p style={{ color: "#666", fontSize: "0.95rem", marginBottom: "24px" }}>
          Ingresa tu correo y te enviaremos un enlace seguro para restablecerla.
        </p>
        
        <form onSubmit={handleReset} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <input 
            type="email" 
            placeholder="Correo electrónico" 
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{ padding: "12px", borderRadius: "8px", border: "1px solid #ddd", width: "100%", fontSize: "1rem" }}
          />
          <button 
            type="submit" 
            disabled={loading}
            style={{ padding: "12px", background: "#212625", color: "white", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: "bold" }}
          >
            {loading ? "ENVIANDO..." : "ENVIAR ENLACE"}
          </button>
        </form>

        <div style={{ marginTop: "24px" }}>
          <Link href="/login" style={{ color: "#666", textDecoration: "none", fontSize: "0.9rem" }}>
            Volver al inicio de sesión
          </Link>
        </div>
      </div>
    </div>
  );
}
