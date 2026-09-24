import { redirect } from "next/navigation";
import DashboardLayoutShell from "@/components/layout/DashboardLayoutShell";
import { getSessionProfile } from "@/lib/auth";

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Misma verificación (cacheada por petición) que usan las páginas y acciones
  const profile = await getSessionProfile();

  // 1. Verificar si hay sesión
  if (!profile) redirect("/login");

  // 2. Verificar que su estado sea "aprobado"
  if (profile.status !== 'aprobado') redirect("/login?status=pending");

  return (
    <DashboardLayoutShell
      userEmail={profile.email}
      userName={profile.nombre || profile.fullName}
      avatarUrl={profile.avatarUrl}
      role={profile.role}
    >
      {children}
    </DashboardLayoutShell>
  );
}
