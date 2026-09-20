import { redirect } from 'next/navigation';

export default function Home() {
  // Redirigir la raíz (/) automáticamente al dashboard
  redirect('/dashboard');
}
