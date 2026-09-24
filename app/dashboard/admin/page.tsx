import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { fetchAllUsers } from "@/app/actions/admin";
import { AdminPanel, type User } from "@/components/admin/AdminPanel";
import { ReloadButton } from "@/components/admin/ReloadButton";
import { can, toRole } from "@/lib/permissions";

export default async function AdminPage() {
  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();

  if (authError || !authData.user) {
    redirect("/login");
  }

  // Supervisores y administrador (cada uno ve lo que su rol permite)
  const { data: perfil, error: dbError } = await supabase
    .from('perfiles')
    .select('role, status')
    .eq('id', authData.user.id)
    .single();

  const role = toRole(perfil?.role);
  if (dbError || perfil?.status !== 'aprobado' || !can.accessPanel(role)) {
    redirect("/dashboard");
  }

  // Cargar usuarios inicialmente en el servidor para renderizado inicial rápido
  const { users } = await fetchAllUsers();

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 w-full max-w-7xl mx-auto pb-10">
      <div className="mb-6 md:mb-8 flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div>
          <h1 className="font-headline-lg text-headline-lg font-bold tracking-tight text-on-surface">
            {role === 'administrador' ? 'Panel de Administrador' : 'Panel de Supervisión'}
          </h1>
          <p className="font-body-lg text-body-lg text-on-surface-variant mt-2 max-w-3xl">
            {role === 'administrador'
              ? 'Gestiona accesos, roles y configuración; revisa solicitudes y la bitácora de todo el personal.'
              : 'Acepta usuarios nuevos, resuelve solicitudes de eliminación y revisa la bitácora de cada turno.'}
          </p>
        </div>
        <div className="flex-shrink-0">
          <ReloadButton />
        </div>
      </div>

      <AdminPanel initialUsers={(users as User[] | undefined) ?? []} role={role} currentUserId={authData.user.id} />
    </div>
  );
}
