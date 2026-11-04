import { redirect } from 'next/navigation'

export default async function TiendaInicio({ params }: PageProps<'/t/[slug]'>) {
  const { slug } = await params
  redirect(`/t/${slug}/caja`)
}
