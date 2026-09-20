import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { fetchAllUsers } from "@/app/actions/admin";
import { AdminPanel } from "@/components/admin/AdminPanel";
import { ReloadButton } from "@/components/admin/ReloadButton";

export default async function AdminPage() {
  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();

  if (authError || !authData.user) {
    redirect("/login");
  }

  // Verificar si es administrador
  const { data: perfil, error: dbError } = await supabase
    .from('perfiles')
    .select('role')
    .eq('id', authData.user.id)
    .single();

  if (dbError || perfil?.role !== 'administrador') {
    redirect("/dashboard");
  }

  // Cargar usuarios inicialmente en el servidor para renderizado inicial rápido
  const { users, error: fetchError } = await fetchAllUsers();

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 w-full max-w-7xl mx-auto pb-10">
      <div className="mb-6 md:mb-8 flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div>
          <h1 className="font-headline-lg text-headline-lg font-bold tracking-tight text-on-surface">Panel de Administrador</h1>
          <p className="font-body-lg text-body-lg text-on-surface-variant mt-2 max-w-3xl">
            Gestiona los accesos, asigna roles operativos y administra los cargos de todo el personal de la plataforma.
          </p>
        </div>
        <div className="flex-shrink-0">
          <ReloadButton />
        </div>
      </div>

      <AdminPanel initialUsers={(users as any) || []} />
    </div>
  );
}
