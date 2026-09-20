"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

export default function UserTable({ initialUsers }: { initialUsers: any[] }) {
  const [users, setUsers] = useState(initialUsers);
  const supabase = createClient();

  const handleUpdateStatus = async (id: string, newStatus: string) => {
    const { error } = await supabase
      .from("perfiles")
      .update({ status: newStatus })
      .eq("id", id);

    if (error) {
      toast.error("Error al actualizar el estado: " + error.message);
    } else {
      toast.success(newStatus === 'aprobado' ? "Usuario aprobado correctamente." : "Usuario rechazado.");
      setUsers(users.filter(u => u.id !== id)); // Remove it from the pending list
    }
  };

  if (users.length === 0) {
    return <p style={{ padding: "20px 0", color: "#666" }}>No hay usuarios pendientes de aprobación.</p>;
  }

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", marginTop: "20px", background: "white", borderRadius: "8px", overflow: "hidden", boxShadow: "0 4px 6px rgba(0,0,0,0.05)" }}>
        <thead>
          <tr style={{ background: "#f0f2f5", textAlign: "left", color: "#333" }}>
            <th style={{ padding: "16px", borderBottom: "2px solid #ddd" }}>Email</th>
            <th style={{ padding: "16px", borderBottom: "2px solid #ddd" }}>Fecha de Registro</th>
            <th style={{ padding: "16px", borderBottom: "2px solid #ddd" }}>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr key={user.id} style={{ borderBottom: "1px solid #eee" }}>
              <td style={{ padding: "16px" }}>{user.email}</td>
              <td style={{ padding: "16px" }}>
                {new Date(user.created_at).toLocaleString()}
              </td>
              <td style={{ padding: "16px", display: "flex", gap: "10px" }}>
                <button 
                  onClick={() => handleUpdateStatus(user.id, 'aprobado')}
                  style={{ padding: "8px 16px", background: "#212625", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "bold" }}
                >
                  Aprobar
                </button>
                <button 
                  onClick={() => handleUpdateStatus(user.id, 'rechazado')}
                  style={{ padding: "8px 16px", background: "transparent", color: "#d93025", border: "1px solid #d93025", borderRadius: "6px", cursor: "pointer", fontWeight: "bold" }}
                >
                  Rechazar
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
