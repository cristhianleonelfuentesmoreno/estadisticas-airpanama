import { revalidatePath } from 'next/cache';
export async function run() {
  revalidatePath('/dashboard/diario');
  revalidatePath('/dashboard/diario', 'page');
  revalidatePath('/dashboard/diario', 'layout');
}
