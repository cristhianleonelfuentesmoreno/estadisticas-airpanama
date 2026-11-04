import { redirect } from 'next/navigation';
import { getMisTiendas } from '@/lib/tienda/servidor';

export default async function Home() {
  // Quien es de una tienda entra directo a su caja; el resto, al panel de antes
  const [tienda] = await getMisTiendas();
  redirect(tienda ? `/t/${tienda.slug}/caja` : '/dashboard');
}
