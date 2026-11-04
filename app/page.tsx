import { redirect } from 'next/navigation';
import { getSessionProfile } from '@/lib/auth';
import { can } from '@/lib/permissions';
import { getMisTiendas } from '@/lib/tienda/servidor';

export default async function Home() {
  const profile = await getSessionProfile();
  if (!profile) redirect('/login');
  if (profile.status !== 'aprobado') redirect('/login?status=pending');

  // Quien es de una tienda entra directo a su caja; el equipo Valis sin tienda, al panel
  const [tienda] = await getMisTiendas();
  if (tienda) redirect(`/t/${tienda.slug}/caja`);
  redirect(can.accessPanel(profile.role) ? '/admin' : '/sin-tienda');
}
