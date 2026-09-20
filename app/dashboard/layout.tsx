import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import DashboardLayoutShell from "@/components/layout/DashboardLayoutShell";

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  
  // 1. Verificar si hay sesión
  const { data: authData } = await supabase.auth.getUser();
  if (!authData?.user) {
    console.log("[DashboardLayout] No user session found. Redirecting to /login.");
    redirect("/login");
  }

  // 2. Verificar que su estado sea "aprobado" y traer rol/nombre
  const { data: perfil, error } = await supabase
    .from('perfiles')
    .select('status, role, nombre')
    .eq('id', authData.user.id)
    .single();

  console.log("[DashboardLayout] User Check:", {
    email: authData.user.email,
    uid: authData.user.id,
    perfilStatus: perfil?.status,
    dbError: error?.message
  });

  if (perfil?.status !== 'aprobado') {
    redirect("/login?status=pending");
  }

  const isAdmin = perfil?.role === 'administrador';

  // Si pasa todas las validaciones, renderiza el dashboard
  return (
    <DashboardLayoutShell 
      userEmail={authData.user.email} 
      userName={perfil?.nombre || authData.user.user_metadata?.full_name}
      avatarUrl={authData.user.user_metadata?.avatar_url}
      isAdmin={isAdmin}
    >
      {children}
    </DashboardLayoutShell>
  );
}
